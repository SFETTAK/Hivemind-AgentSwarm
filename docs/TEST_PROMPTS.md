# Hivemind Test Prompts

These prompts are designed to trigger QUEEN to deploy agents and make them do actual work.

---

## 🟢 Basic Agent Deployment

### Deploy a single agent
```
Deploy a FORGE agent to create a hello world Python script
```

### Deploy multiple agents
```
I need a FORGE to write code, a SENTINEL to test it, and a SCRIBE to document it. Deploy all three.
```

### Deploy all agents
```
Wake up the whole swarm - deploy FORGE, SENTINEL, ORACLE, NEXUS, and SCRIBE
```

---

## 🟡 Simple Tasks (Should Work Immediately)

### Create a file
```
Have FORGE create a file called test.py that prints "Hello from Hivemind"
```

### Create multiple files
```
FORGE: Create three files - main.py, utils.py, and config.py with basic boilerplate
```

### Research task
```
ORACLE: Research the best practices for Python project structure and write a summary
```

### Documentation task
```
SCRIBE: Create a README.md for a new Python project called "hivemind-demo"
```

---

## 🔴 Complex Multi-Agent Tasks

### Build a feature
```
Build a simple todo list API:
1. FORGE creates the Flask app
2. SENTINEL writes tests
3. SCRIBE documents the endpoints
Start now.
```

### Code review workflow
```
FORGE: Create a function that calculates fibonacci numbers
Then have SENTINEL review it and suggest improvements
```

### Full project setup
```
Set up a new Python project:
- FORGE: Create project structure and main.py
- SCRIBE: Write README and requirements.txt
- SENTINEL: Create test_main.py with basic tests
Execute this plan now.
```

---

## 🎯 Direct Commands (Most Reliable)

These bypass QUEEN's "helpful" clarification questions:

### Force deployment
```
[TOOL: deploy_agent(forge, test-task)]
```

### Force message to agent
```
[TOOL: send_to_agent(hive-forge-test-task, "Create a file called hello.py")]
```

### Force broadcast
```
[TOOL: broadcast("Everyone report your status")]
```

### Check status
```
[TOOL: get_status()]
```

---

## 💡 Tips for Getting QUEEN to Act

1. **Be specific** - "Create X" not "Can you create X?"
2. **Use imperatives** - "Deploy FORGE" not "Would you deploy FORGE?"
3. **Include "now"** - "Do this now" triggers action
4. **Avoid questions** - Questions make QUEEN ask clarifying questions back
5. **Give concrete tasks** - "Create hello.py" not "create a file"

### Bad (triggers clarification):
```
Can you maybe deploy an agent to help with something?
```

### Good (triggers action):
```
Deploy FORGE to create hello.py that prints "test". Do it now.
```

---

## 🧪 Quick Test Sequence

Run these in order to verify everything works:

1. **Test deployment:**
   ```
   Deploy FORGE with task "quicktest"
   ```

2. **Test communication:**
   ```
   Send to FORGE: Create a file called test.txt with the text "Hivemind works!"
   ```

3. **Test broadcast:**
   ```
   Broadcast to all agents: Report your current status
   ```

4. **Test status:**
   ```
   Show me the swarm status
   ```

---

## 🐛 If Nothing Happens

If QUEEN responds but agents don't appear or do anything:

1. Check the terminal panel on the right - is aider running?
2. Look for errors in the agent terminal output
3. Verify API key is set in settings
4. Try the direct [TOOL: ...] commands above
5. Check if agents show in the topology (left sidebar)

