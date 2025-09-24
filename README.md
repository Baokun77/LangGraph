# LangGraph Agents: ReAct, ToT, and Reflect

A comprehensive implementation of three advanced AI agent architectures using LangGraph, featuring ReAct (Reasoning and Acting), Tree of Thoughts (ToT), and Reflect agents with global memory.

## 🚀 Features

### 🤖 Three Agent Types

1. **ReAct Agent** - Reasoning and Acting pattern
   - Think → Act → Observe loop
   - Direct answers and web search capabilities
   - Fast and efficient for simple tasks

2. **Tree of Thoughts (ToT) Agent** - Multi-candidate reasoning
   - Expand → Evaluate → Select workflow
   - Generates multiple solution approaches
   - Thorough evaluation and selection process

3. **Reflect Agent** - Learning from failures
   - Think → Act → Reflect cycle
   - Global memory for failed attempts
   - Self-improving through reflection

### 📊 Performance Evaluation

Comprehensive evaluation framework testing all agents on:
- Factual question answering
- Basic arithmetic
- Web search tasks
- Logical reasoning
- Creative tasks

## 📁 Project Structure

```
LangGraph/
├── ReAct_agents.mts          # ReAct agent implementation
├── ToT_langgraph.mts         # Tree of Thoughts agent
├── Reflect_langgraph.mts     # Reflect agent with global memory
├── evaluation_framework.mts   # Performance evaluation system
├── evaluation_results.csv     # Detailed performance metrics
├── evaluation_results.md      # Analysis and recommendations
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Baokun77/LangGraph.git
   cd LangGraph
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Add your API keys to the agent files
   # OpenAI API Key
   # Tavily API Key (for search functionality)
   ```

## 🚀 Usage

### Running Individual Agents

**ReAct Agent:**
```bash
npx tsx ReAct_agents.mts
```

**Tree of Thoughts Agent:**
```bash
npx tsx ToT_langgraph.mts
```

**Reflect Agent:**
```bash
npx tsx Reflect_langgraph.mts
```

### Running Performance Evaluation

```bash
npx tsx evaluation_framework.mts
```

This will:
- Test all three agents on 5 different task types
- Measure success rate, inference time, and token usage
- Generate CSV and Markdown reports

## 📊 Performance Results

### Summary Statistics

| Agent | Success Rate | Avg Time (s) | Best For |
|-------|-------------|--------------|----------|
| **Reflect** | **100.0%** | **1.14s** | All task types |
| **ReAct** | **80.0%** | **1.66s** | Simple, fast tasks |
| **ToT** | **20.0%** | **10.70s** | Complex reasoning |

### Key Findings

- **Reflect Agent**: Best overall performance with global memory learning
- **ReAct Agent**: Fast and reliable for direct tasks
- **ToT Agent**: Thorough but slower, good for complex reasoning

## 🔧 Technical Details

### Dependencies

- **LangGraph**: State management and workflow orchestration
- **LangChain**: LLM integration and tool usage
- **OpenAI**: GPT-4o-mini for reasoning
- **Tavily**: Web search capabilities
- **TypeScript**: Type-safe development

### Agent Architectures

#### ReAct Pattern
```
Question → Think → Act → Observe → [Loop if needed] → Answer
```

#### Tree of Thoughts
```
Question → Expand (generate candidates) → Evaluate (score) → Select (best) → Answer
```

#### Reflect Pattern
```
Question → Think → Act → Reflect → [Memory if failed] → Retry or Answer
```

## 🧠 Global Memory System

The Reflect agent features a persistent global memory system that:
- Stores failed attempts across conversations
- Learns from previous mistakes
- Improves performance over time
- Maintains context between sessions

## 📈 Evaluation Metrics

The evaluation framework measures:
- **Success Rate**: Percentage of correct answers
- **Inference Time**: Average response time in seconds
- **Token Usage**: API consumption tracking
- **Task Categories**: Factual, arithmetic, search, reasoning, creative

## 🎯 Use Cases

### ReAct Agent
- Quick fact-checking
- Simple calculations
- Direct question answering
- Real-time applications

### ToT Agent
- Complex problem solving
- Research and analysis
- Multi-step reasoning
- When thoroughness is priority

### Reflect Agent
- Learning systems
- Adaptive applications
- Error-prone environments
- Continuous improvement scenarios

## 🔒 Security

- API keys are included in the code for demonstration
- **Important**: Replace with your own keys before production use
- Consider using environment variables for production

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For questions or issues, please open an issue on GitHub.

## 🔮 Future Enhancements

- [ ] Add more agent types (Self-Refine, Constitutional AI)
- [ ] Implement agent collaboration
- [ ] Add more evaluation metrics
- [ ] Create web interface
- [ ] Add agent comparison visualizations

---

**Built with ❤️ using LangGraph and TypeScript**
