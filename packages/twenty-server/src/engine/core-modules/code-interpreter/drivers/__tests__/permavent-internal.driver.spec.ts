import { PermaventInternalDriver } from 'src/engine/core-modules/code-interpreter/drivers/permavent-internal.driver';

describe('PermaventInternalDriver', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('executes code, maps files and replays callbacks', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          stdout: 'first\nsecond\n',
          stderr: '',
          exitCode: 0,
          files: [
            {
              filename: 'chart.png',
              contentBase64: Buffer.from('image').toString('base64'),
              mimeType: 'image/png',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const onStdout = jest.fn();
    const onResult = jest.fn();
    const driver = new PermaventInternalDriver({
      runnerUrl: 'http://runner:8080/',
      authToken: 'safe-test-token',
      executionTimeoutMs: 120_000,
      requestTimeoutMs: 130_000,
    });

    const result = await driver.execute(
      'print("safe")',
      [
        {
          filename: '../sample.xlsx',
          content: Buffer.from('PK-safe'),
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
      {
        sessionId: 'workspace:thread',
        env: { TWENTY_SERVER_URL: 'https://test' },
      },
      { onStdout, onResult },
    );

    expect(result.exitCode).toBe(0);
    expect(result.files[0]?.content.toString()).toBe('image');
    expect(onStdout).toHaveBeenNthCalledWith(1, 'first');
    expect(onStdout).toHaveBeenNthCalledWith(2, 'second');
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^http:\/\/runner:8080\/v1\/sessions\/[a-f0-9]{64}\/execute$/,
      ),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('releases persistent sessions using an opaque identifier', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const driver = new PermaventInternalDriver({
      runnerUrl: 'http://runner:8080',
      authToken: 'safe-test-token',
      executionTimeoutMs: 120_000,
      requestTimeoutMs: 130_000,
    });

    await driver.releaseSession('workspace:thread');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^http:\/\/runner:8080\/v1\/sessions\/[a-f0-9]{64}$/,
      ),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('does not expose the runner response body on failure', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'sensitive upstream detail' }), {
        status: 502,
      }),
    );
    const driver = new PermaventInternalDriver({
      runnerUrl: 'http://runner:8080',
      authToken: 'safe-test-token',
      executionTimeoutMs: 120_000,
      requestTimeoutMs: 130_000,
    });

    await expect(
      driver.execute('print("safe")', undefined, { sessionId: 'thread' }),
    ).rejects.toThrow('Internal code interpreter runner request failed');
  });
  it('isolates persistent Python sessions when actorKey changes', async () => {
    fetchMock.mockImplementation((_url: string, options: RequestInit) => {
      if (options.method === 'DELETE') {
        return Promise.resolve(new Response('{}', { status: 200 }));
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            stdout: 'ok',
            stderr: '',
            exitCode: 0,
            files: [],
          }),
          { status: 200 },
        ),
      );
    });
    const driver = new PermaventInternalDriver({
      runnerUrl: 'http://runner:8080',
      authToken: 'safe-test-token',
      executionTimeoutMs: 120_000,
      requestTimeoutMs: 130_000,
    });
    const context = { sessionId: 'workspace:thread' };

    await driver.execute('print(1)', undefined, {
      ...context,
      actorKey: 'member-A:application-1',
    });
    await driver.execute('print(2)', undefined, {
      ...context,
      actorKey: 'member-A:application-1',
    });
    await driver.execute('print(3)', undefined, {
      ...context,
      actorKey: 'member-B:application-2',
    });

    const executeUrls = fetchMock.mock.calls
      .filter(([, init]) => init.method === 'POST')
      .map(([url]) => url as string);
    const deleteUrls = fetchMock.mock.calls
      .filter(([, init]) => init.method === 'DELETE')
      .map(([url]) => url as string);

    expect(executeUrls).toHaveLength(3);
    expect(executeUrls[0]).toEqual(executeUrls[1]);
    expect(executeUrls[2]).not.toEqual(executeUrls[0]);
    expect(deleteUrls).toEqual([
      executeUrls[0].replace('/execute', ''),
    ]);

    await driver.releaseSession(context.sessionId);
    const finalDeletedUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
    expect(finalDeletedUrl).toEqual(executeUrls[2].replace('/execute', ''));
  });

  it('fails closed when switching actors cannot release the old session', async () => {
    fetchMock.mockImplementation((_url: string, options: RequestInit) => {
      if (options.method === 'DELETE') {
        return Promise.resolve(new Response('{}', { status: 503 }));
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({ stdout: '', stderr: '', exitCode: 0, files: [] }),
          { status: 200 },
        ),
      );
    });
    const driver = new PermaventInternalDriver({
      runnerUrl: 'http://runner:8080',
      authToken: 'safe-test-token',
      executionTimeoutMs: 120_000,
      requestTimeoutMs: 130_000,
    });

    await driver.execute('print(1)', undefined, {
      sessionId: 'thread',
      actorKey: 'actor-a',
    });

    await expect(
      driver.execute('print(2)', undefined, {
        sessionId: 'thread',
        actorKey: 'actor-b',
      }),
    ).rejects.toThrow('Internal code interpreter runner request failed');

    expect(
      fetchMock.mock.calls.filter(([, init]) => init.method === 'POST'),
    ).toHaveLength(1);
  });

});
