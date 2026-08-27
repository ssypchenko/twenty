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
});
