import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StructuredTool } from '@langchain/core/tools';
import { convertMcpToolToLangchainTool, loadMcpTools } from '../src/tools';

// Mock Client
const mockClient: jest.Mocked<Client> = {
  listTools: jest.fn(),
  callTool: jest.fn(),
  close: jest.fn(),
} as unknown as jest.Mocked<Client>;

describe('tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('convertMcpToolToLangchainTool', () => {
    it('should convert an MCP tool to a LangChain tool', async () => {
      // Mock tool call result
      const mockToolResult = {
        content: [
          {
            type: 'text',
            text: '42',
          },
        ],
      };

      mockClient.callTool.mockResolvedValue(mockToolResult);

      // Create a LangChain tool from an MCP tool
      const tool = convertMcpToolToLangchainTool(mockClient, 'calculator', 'A calculator tool', {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      });

      // Verify the tool properties
      expect(tool).toBeInstanceOf(StructuredTool);
      expect(tool.name).toBe('calculator');
      expect(tool.description).toBe('A calculator tool');

      // Invoke the tool
      const result = await tool.invoke({ a: 2, b: 3 });

      // Verify the tool was called with the correct parameters
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'calculator',
        arguments: { a: 2, b: 3 },
      });

      // Verify the result
      expect(result).toBe('42');
    });

    it('should handle errors from the MCP tool', async () => {
      // Mock tool call result with an error
      const mockToolResult = {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Invalid input',
          },
        ],
      };

      mockClient.callTool.mockResolvedValue(mockToolResult);

      // Create a LangChain tool from an MCP tool
      const tool = convertMcpToolToLangchainTool(mockClient, 'calculator', 'A calculator tool', {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      });

      // Invoke the tool and expect it to throw
      await expect(tool.invoke({ a: -1, b: 3 })).rejects.toThrow('Invalid input');
    });

    it('should handle non-text content from the MCP tool', async () => {
      // Mock tool call result with non-text content
      const mockContent = {
        type: 'image',
        data: 'base64-encoded-data',
        mimeType: 'image/png',
      };

      const mockToolResult = {
        content: [mockContent],
      };

      mockClient.callTool.mockResolvedValue(mockToolResult);

      // Create a LangChain tool from an MCP tool
      const tool = convertMcpToolToLangchainTool(
        mockClient,
        'image-generator',
        'An image generator tool',
        {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
          },
          required: ['prompt'],
        }
      );

      // Invoke the tool
      const result = await tool.invoke({ prompt: 'A cat' });

      // Verify the result is the content object
      expect(result).toBe('[object Object]'); // String(_convertCallToolResult) converts objects to string
    });
  });

  describe('loadMcpTools', () => {
    it('should load all tools from an MCP client', async () => {
      // Mock listTools response
      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: 'add',
            description: 'Add two numbers',
            inputSchema: {
              type: 'object',
              properties: {
                a: { type: 'number' },
                b: { type: 'number' },
              },
              required: ['a', 'b'],
            },
          },
          {
            name: 'subtract',
            description: 'Subtract two numbers',
            inputSchema: {
              type: 'object',
              properties: {
                a: { type: 'number' },
                b: { type: 'number' },
              },
              required: ['a', 'b'],
            },
          },
        ],
      });

      // Load tools
      const tools = await loadMcpTools(mockClient);

      // Verify listTools was called
      expect(mockClient.listTools).toHaveBeenCalled();

      // Verify the tools were loaded correctly
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('add');
      expect(tools[1].name).toBe('subtract');
    });

    it('should handle empty tool descriptions', async () => {
      // Mock listTools response with a tool missing a description
      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: 'add',
            inputSchema: {
              type: 'object',
              properties: {
                a: { type: 'number' },
                b: { type: 'number' },
              },
              required: ['a', 'b'],
            },
          },
        ],
      });

      // Load tools
      const tools = await loadMcpTools(mockClient);

      // Verify the tool was loaded with an empty description
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('add');
      expect(tools[0].description).toBe('');
    });
  });
});
