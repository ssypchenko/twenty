// Python helper that gets prepended to user code for MCP access
export const TWENTY_MCP_HELPER = `# Auto-injected Twenty MCP helper - provides access to Twenty tools
import os
import json

try:
    import requests
    _REQUESTS_AVAILABLE = True
except ImportError:
    _REQUESTS_AVAILABLE = False

class TwentyMCP:
    """Helper for calling Twenty tools from sandboxed code.

    Two categories of tools exist behind /mcp:

     - MCP-native: execute_tool and the read-only discovery and help tools.

     - Workspace catalog: read-only database tools such as
       find_many_companies, find_one_company and group_by_companies. These are
       reached through execute_tool as a dispatcher. Mutation tools are denied
       by the signed sandbox token and the MCP server.

    call_tool(name, args) accepts both — catalog tools are routed via
    execute_tool transparently and the envelope is unwrapped, so callers
    see the inner tool's result directly.

    Use lookup_by(plural, field, values) for bounded read-only relation lookups.
    """

    _MCP_NATIVE_TOOLS = frozenset({
        'execute_tool',
        'get_tool_catalog',
        'learn_tools',
        'load_skills',
        'list_object_metadata_names',
        'list_skills',
        'search_help_center',
    })

    _READ_ONLY_CATALOG_PREFIXES = (
        'find_one_',
        'find_many_',
        'group_by_',
    )

    def __init__(self):
        self.url = os.environ.get('TWENTY_SERVER_URL', '')
        self.token = os.environ.get('TWENTY_API_TOKEN', '')
        self._available = _REQUESTS_AVAILABLE and bool(self.url) and bool(self.token)

    @property
    def available(self) -> bool:
        """Check if MCP bridge is available"""
        return self._available

    def call_tool(self, name: str, arguments: dict = None):
        """
        Call any Twenty tool by name.

        Read-only catalog tools (find_many_companies, find_one_company, …) are routed
        through execute_tool. MCP-native tools are called directly.
        The execute_tool envelope { success, message, result } is
        unwrapped so you always get the inner tool's result back.

        Args:
            name: Tool name (catalog or MCP-native)
            arguments: Tool arguments as a dictionary

        Returns:
            Tool result as parsed JSON

        Example:
            companies = twenty.call_tool('find_many_companies', {'limit': 5})
            # companies == {'records': [...], 'count': '5'}
        """
        if not self._available:
            raise RuntimeError('Twenty MCP bridge not available. Missing requests library or credentials.')

        if name not in self._MCP_NATIVE_TOOLS and not name.startswith(self._READ_ONLY_CATALOG_PREFIXES):
            raise PermissionError(f'Twenty MCP tool "{name}" is not available in the read-only Code Interpreter context.')

        if name == 'execute_tool':
            requested_tool = (arguments or {}).get('toolName')
            if not isinstance(requested_tool, str) or not requested_tool.startswith(self._READ_ONLY_CATALOG_PREFIXES):
                raise PermissionError('Twenty MCP execute_tool is restricted to read-only database tools in Code Interpreter.')

        if name in self._MCP_NATIVE_TOOLS:
            return self._raw_mcp_call(name, arguments)

        wrapped = self._raw_mcp_call('execute_tool', {
            'toolName': name,
            'arguments': arguments or {},
        })
        # execute_tool returns one of:
        #   success: { success: True,  message, result: {...} }
        #   failure: { success: False, message, error }
        # Raise on failure, unwrap on success, pass through unknown shapes.
        if isinstance(wrapped, dict):
            if wrapped.get('success') is False:
                raise Exception(wrapped.get('error') or wrapped.get('message') or
                                f"execute_tool failed for {name}")
            if 'result' in wrapped:
                return wrapped['result']
        return wrapped

    def lookup_by(self, plural: str, field: str, values: list, select: list = None):
        """
        Resolve records by a key field, returning a { value: id } map.

        Use this to build relation lookups (e.g. company domain/name -> id) before
        an import, since relations link by ID. The query is bounded to the distinct
        values you pass (batched with an 'in' filter, max 200 per call), so it never
        reads the whole object into the sandbox.

        Args:
            plural: Plural object name, e.g. 'companies'.
            field: Field path to match on, e.g. 'name' or 'domainName.primaryLinkUrl'.
            values: List of key values referenced by the import.
            select: Fields to return (defaults to the matched field + id).

        Returns:
            dict mapping each found value to its record id. Missing values are absent.

        Example:
            company_ids = twenty.lookup_by('companies', 'name', ['Acme', 'Globex'])
            # { 'Acme': 'uuid-1', 'Globex': 'uuid-2' }
        """
        distinct = [value for value in dict.fromkeys(values) if value is not None]
        select_fields = select or ['id', field]
        mapping = {}
        for offset in range(0, len(distinct), 200):
            chunk = distinct[offset:offset + 200]
            result = self.call_tool('find_many_' + plural, {
                'limit': 200,
                'select': select_fields,
                **self._nest_field_path(field, {'in': chunk}),
            })
            for record in (result.get('records', []) if isinstance(result, dict) else []):
                key = self._read_field_path(record, field)
                if key is not None and key not in mapping:
                    mapping[key] = record.get('id')
        return mapping

    @staticmethod
    def _nest_field_path(field: str, leaf: dict):
        """Turn 'domainName.primaryLinkUrl' + leaf into a nested filter dict."""
        parts = field.split('.')
        nested = leaf
        for part in reversed(parts):
            nested = {part: nested}
        return nested

    @staticmethod
    def _read_field_path(record: dict, field: str):
        """Read a possibly nested field path (e.g. 'domainName.primaryLinkUrl')."""
        current = record
        for part in field.split('.'):
            if not isinstance(current, dict):
                return None
            current = current.get(part)
        return current

    def _raw_mcp_call(self, name: str, arguments: dict = None):
        """Low-level: issue a tools/call against the MCP surface verbatim."""
        response = requests.post(
            f"{self.url}/mcp",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": name, "arguments": arguments or {}}
            },
            timeout=30
        )
        response.raise_for_status()
        result = response.json()

        if "error" in result:
            raise Exception(f"MCP Error: {result['error'].get('message', 'Unknown error')}")

        content = result.get("result", {}).get("content", [])
        if content and content[0].get("type") == "text":
            return json.loads(content[0]["text"])
        return result.get("result")

# --------------------------------------------------------------------------
# \`twenty\` is a pre-built instance of the TwentyMCP class above. It is
# already bound in this module scope — DO NOT \`import twenty\`. There is
# no Python package by that name. Just use it directly, e.g.:
#     companies = twenty.call_tool('find_many_companies', {'limit': 10})
# --------------------------------------------------------------------------
twenty = TwentyMCP()
`;
