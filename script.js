/** ==========================================
 *  IDE UI: Подсветка, Вкладки, Файлы
 *  ========================================== */

// Создаем "правила подсветки" для языка KiiLang
CodeMirror.defineSimpleMode("kiilang", {
  start: [
    // 1. Строки (как в JS)
    { regex: /"(?:[^\\]|\\.)*?(?:"|$)/, token: "string" },

    // 2. Ключевые слова / Команды (будут как if/for/return в JS)
    {
      regex:
        /\b(?:out|outln|print|println|in|run|runif|loop|equit|del|import|unimport|reload|at|lastof|len|unload)\b/,
      token: "keyword",
    },

    // 3. Булевы значения и спец-константы (как true/false/null в JS)
    { regex: /\b(?:true|false)\b/, token: "atom" },

    // 4. Числа (как в JS)
    { regex: /\b\d+(\.\d+)?\b/, token: "number" },

    // 5. Имена блоков (Labels) - сделаем их как определения функций (обычно ярко-синие или желтые)
    { regex: /[a-zA-Z0-9_-]+(?=:)/, token: "def" },
    { regex: /:/, token: "punctuation" }, // Двоеточие отдельно

    // 6. Операторы (самая сложная часть)
    // Мы используем стандартный токен "operator"
    {
      regex:
        /->|=>|<-|#=|==|!=|>=|<=|\+=|-=|\*=|\/=|\[\+\]|\[-\]|-=\]|\.\.|\.|>|<|&&|\|\||[+\-*\/=!|=]/,
      token: "operator",
    },

    // 7. Комментарии (как в JS)
    { regex: /\/\/.*/, token: "comment" },

    // 8. Переменные (все остальное)
    { regex: /[a-zA-Z_][\w]*/, token: "variable" },
  ],
  meta: {
    lineComment: "//",
  },
});

// Виртуальная файловая система
const VirtualFS = {
  files: {
    "main.kii":
      'main:\nprint "Hello KiiLang!"\na = 10\na -> test\nrun test\n\ntest:\nprint a\nprintln ""\n',
  },
  openTabs: ["main.kii"],
  activeFile: "main.kii",
};

const editor = CodeMirror(document.getElementById("editor-container"), {
  theme: "dracula",
  mode: "kiilang",
  lineNumbers: true,
  tabSize: 4,
  indentWithTabs: false,
});

editor.on("change", () => {
  VirtualFS.files[VirtualFS.activeFile] = editor.getValue();
});

function renderExplorer() {
  const list = document.getElementById("file-list");
  list.innerHTML = "";
  Object.keys(VirtualFS.files).forEach((file) => {
    let li = document.createElement("li");
    li.className = file === VirtualFS.activeFile ? "active" : "";
    li.innerHTML = `<span>${file}</span> <span class="delete-file" title="Удалить" onclick="deleteFile(event, '${file}')">×</span>`;
    li.onclick = () => openTab(file);
    list.appendChild(li);
  });
}

function renderTabs() {
  const tabs = document.getElementById("tabs-container");
  tabs.innerHTML = "";
  VirtualFS.openTabs.forEach((file) => {
    let tab = document.createElement("div");
    tab.className = `tab ${file === VirtualFS.activeFile ? "active" : ""}`;
    tab.innerHTML = `<span>${file}</span> <span class="tab-close" onclick="closeTab(event, '${file}')">×</span>`;
    tab.onclick = () => switchToTab(file);
    tabs.appendChild(tab);
  });
}

function openTab(filename) {
  if (!VirtualFS.openTabs.includes(filename)) VirtualFS.openTabs.push(filename);
  switchToTab(filename);
}

function switchToTab(filename) {
  VirtualFS.activeFile = filename;
  editor.setValue(VirtualFS.files[filename]);
  renderExplorer();
  renderTabs();
}

function closeTab(e, filename) {
  e.stopPropagation();
  VirtualFS.openTabs = VirtualFS.openTabs.filter((f) => f !== filename);
  if (VirtualFS.activeFile === filename) {
    if (VirtualFS.openTabs.length > 0) switchToTab(VirtualFS.openTabs[0]);
    else {
      VirtualFS.activeFile = null;
      editor.setValue("");
      renderExplorer();
      renderTabs();
    }
  } else {
    renderTabs();
  }
}

function deleteFile(e, filename) {
  e.stopPropagation();
  if (filename === "main.kii") return alert("main.kii удалять нельзя!");
  delete VirtualFS.files[filename];
  closeTab(e, filename);
  renderExplorer();
}

document.getElementById("add-file-btn").addEventListener("click", () => {
  let name = prompt("Имя файла:", "module.kii");
  if (name && !VirtualFS.files[name]) {
    VirtualFS.files[name] = "";
    renderExplorer();
    openTab(name);
  }
});

// Инициализация
switchToTab("main.kii");

/** ==========================================
 *  Терминал
 *  ========================================== */
const Terminal = {
  outputEl: document.getElementById("terminal-output"),
  inputLine: document.getElementById("terminal-input-line"),
  inputEl: document.getElementById("terminal-input"),
  resolveInput: null,

  print: (text) => {
    Terminal.outputEl.textContent += text;
    Terminal.scrollToBottom();
  },
  println: (text) => {
    Terminal.outputEl.textContent += text + "\n";
    Terminal.scrollToBottom();
  },
  clear: () => {
    Terminal.outputEl.textContent = "";
  },
  scrollToBottom: () => {
    document.getElementById("terminal-output").scrollTop =
      document.getElementById("terminal-output").scrollHeight;
  },

  readAsync: () => {
    return new Promise((resolve) => {
      Terminal.inputLine.style.display = "flex";
      Terminal.inputEl.value = "";
      Terminal.inputEl.focus();
      Terminal.resolveInput = resolve;
      Terminal.scrollToBottom();
    });
  },
};

Terminal.inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && Terminal.resolveInput) {
    const val = Terminal.inputEl.value;
    Terminal.println(val);
    Terminal.inputLine.style.display = "none";
    let resolve = Terminal.resolveInput;
    Terminal.resolveInput = null;
    resolve(val);
  }
});

/** ==========================================
 *  ДВИЖОК KiiLang
 *  ========================================== */
const Types = { Int: 0, String: 1, Boolean: 2, List: 3, Null: 4 };

class Variable {
  constructor(content, isStatic = false) {
    this.isStatic = isStatic;
    if (content instanceof Variable) content = content.Get();

    this.content = content;
    if (
      typeof content === "boolean" ||
      content === "true" ||
      content === "false"
    ) {
      this.type = Types.Boolean;
      this.content = content === true || content === "true";
    } else if (Array.isArray(content)) {
      this.type = Types.List;
    } else if (
      !isNaN(content) &&
      content !== "" &&
      content !== null &&
      typeof content !== "boolean"
    ) {
      this.type = Types.Int;
      this.content = parseInt(content);
    } else if (content === null || content === undefined) {
      this.type = Types.Null;
    } else {
      this.type = Types.String;
      this.content = String(content);
    }
  }
  Set(val) {
    this.content = val;
  }
  Get() {
    return this.content;
  }
}

class Memory {
  constructor() {
    this.variables = {};
  }
  Clean() {
    for (let key in this.variables) {
      if (!this.variables[key].isStatic) delete this.variables[key];
    }
  }
}

class Ch {
  static VarExist(block, name) {
    if (
      typeof name === "string" &&
      Executor.MemoryOfBlocks[block]?.variables[name]
    ) {
      return Executor.MemoryOfBlocks[block].variables[name].Get();
    }
    if (name === "true") return true;
    if (name === "false") return false;
    return name;
  }
}

const OPs = {};
function regOp(sign, priority, isBinary, action) {
  OPs[sign] = { priority, isBinary, Do: action };
}

// Математика
regOp("*", 5, true, async (ctx, args) =>
  args.reduce((acc, y) => acc * parseInt(Ch.VarExist(ctx.block, y)), 1),
);
regOp(
  "/",
  5,
  true,
  async (ctx, args) =>
    parseInt(Ch.VarExist(ctx.block, args[0])) /
    parseInt(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "|",
  5,
  true,
  async (ctx, args) =>
    parseFloat(Ch.VarExist(ctx.block, args[0])) /
    parseFloat(Ch.VarExist(ctx.block, args[1])),
);
regOp("+", 4, true, async (ctx, args) => {
  try {
    let isStr = args.some((y) => isNaN(Ch.VarExist(ctx.block, y)));
    if (isStr) return args.map((y) => Ch.VarExist(ctx.block, y)).join("");
    return args.reduce(
      (acc, y) => acc + parseInt(Ch.VarExist(ctx.block, y)),
      0,
    );
  } catch {
    return args.map((y) => Ch.VarExist(ctx.block, y)).join("");
  }
});
regOp(
  "-",
  4,
  true,
  async (ctx, args) =>
    parseInt(Ch.VarExist(ctx.block, args[0])) -
    parseInt(Ch.VarExist(ctx.block, args[1])),
);

// Логика и сравнение
regOp(
  "!",
  3,
  false,
  async (ctx, args) => !Boolean(Ch.VarExist(ctx.block, args[0])),
);
regOp(
  ">",
  3,
  true,
  async (ctx, args) =>
    parseInt(Ch.VarExist(ctx.block, args[0])) >
    parseInt(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "<",
  3,
  true,
  async (ctx, args) =>
    parseInt(Ch.VarExist(ctx.block, args[0])) <
    parseInt(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  ">=",
  3,
  true,
  async (ctx, args) =>
    parseInt(Ch.VarExist(ctx.block, args[0])) >=
    parseInt(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "<=",
  3,
  true,
  async (ctx, args) =>
    parseInt(Ch.VarExist(ctx.block, args[0])) <=
    parseInt(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "==",
  3,
  true,
  async (ctx, args) =>
    String(Ch.VarExist(ctx.block, args[0])) ===
    String(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "!=",
  3,
  true,
  async (ctx, args) =>
    String(Ch.VarExist(ctx.block, args[0])) !==
    String(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "&&",
  2,
  true,
  async (ctx, args) =>
    Boolean(Ch.VarExist(ctx.block, args[0])) &&
    Boolean(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "||",
  2,
  true,
  async (ctx, args) =>
    Boolean(Ch.VarExist(ctx.block, args[0])) ||
    Boolean(Ch.VarExist(ctx.block, args[1])),
);

// Присваивание
regOp("=", 0, true, async (ctx, args) => {
  let val = Ch.VarExist(ctx.block, args[1]);
  Executor.MemoryOfBlocks[ctx.block].variables[args[0]] = new Variable(val);
  return val;
});
regOp("#=", 0, true, async (ctx, args) => {
  let val = Ch.VarExist(ctx.block, args[1]);
  let mem = Executor.MemoryOfBlocks[ctx.block].variables;
  if (!mem[args[0]] || !mem[args[0]].isStatic)
    mem[args[0]] = new Variable(val, true);
  return val;
});
regOp("+=", 0, true, async (ctx, args) => {
  let mem = Executor.MemoryOfBlocks[ctx.block].variables;
  let old = mem[args[0]].Get();
  let add = Ch.VarExist(ctx.block, args[1]);
  mem[args[0]].Set(
    isNaN(old) || isNaN(add) ? old + add : parseInt(old) + parseInt(add),
  );
  return mem[args[0]].Get();
});
regOp("-=", 0, true, async (ctx, args) => {
  let mem = Executor.MemoryOfBlocks[ctx.block].variables;
  mem[args[0]].Set(
    parseInt(mem[args[0]].Get()) - parseInt(Ch.VarExist(ctx.block, args[1])),
  );
});
regOp("*=", 0, true, async (ctx, args) => {
  let mem = Executor.MemoryOfBlocks[ctx.block].variables;
  mem[args[0]].Set(
    parseInt(mem[args[0]].Get()) * parseInt(Ch.VarExist(ctx.block, args[1])),
  );
});
regOp("/=", 0, true, async (ctx, args) => {
  let mem = Executor.MemoryOfBlocks[ctx.block].variables;
  mem[args[0]].Set(
    Math.floor(
      parseInt(mem[args[0]].Get()) / parseInt(Ch.VarExist(ctx.block, args[1])),
    ),
  );
});

// Вывод и Ввод
regOp("out", 0, false, async (ctx, args) => {
  let val = Ch.VarExist(ctx.block, args[0]);
  Terminal.print(String(val));
  return val;
});
regOp("outln", 0, false, async (ctx, args) => {
  let val = Ch.VarExist(ctx.block, args[0]);
  Terminal.println(String(val));
  return val;
});
regOp("print", 0, false, async (ctx, args) => OPs["out"].Do(ctx, args));
regOp("println", 0, false, async (ctx, args) => OPs["outln"].Do(ctx, args));
regOp("in", 0, false, async (ctx, args) => {
  let input = await Terminal.readAsync();
  Executor.MemoryOfBlocks[ctx.block].variables[args[0]] = new Variable(input);
  return "^";
});

// Управление потоком
regOp("run", 0, false, async (ctx, args) => {
  if (Executor.Blocks.includes(args[0])) await Executor.Exec(args[0]);
  return "^";
});
regOp("runif", 0, true, async (ctx, args) => {
  let cond = Ch.VarExist(ctx.block, args[0]);
  if (Array.isArray(args[1])) {
    if (cond && Executor.Blocks.includes(args[1][1]))
      await Executor.Exec(args[1][1]);
    else if (!cond && Executor.Blocks.includes(args[1][0]))
      await Executor.Exec(args[1][0]);
  } else {
    if (!cond && Executor.Blocks.includes(args[1]))
      await Executor.Exec(args[1]); // КАК В C#: ЗАПУСК ЕСЛИ FALSE
  }
  return "^";
});
regOp("loop", 0, false, async (ctx, args) => {
  let target = String(Ch.VarExist(ctx.block, args[0]));
  if (!Executor.Blocks.includes(target)) throw new Error("K0004");
  while (true) {
    await Executor.Exec(target);
    await new Promise((r) => setTimeout(r, 0));
  }
});
regOp("equit", 0, false, async (ctx, args) => {
  throw new Error("EXIT");
});

// Передача данных
regOp("->", 0, true, async (ctx, args) => {
  let targets = Array.isArray(args[1]) ? args[1] : [args[1]];
  let vars = Array.isArray(args[0]) ? args[0] : [args[0]];
  for (let target of targets) {
    if (!Executor.Blocks.includes(target)) continue;
    for (let v of vars)
      Executor.MemoryOfBlocks[target].variables[v] = new Variable(
        Ch.VarExist(ctx.block, v),
      );
  }
  return "^";
});
regOp("=>", 0, true, async (ctx, args) => {
  await OPs["->"].Do(ctx, args);
  await Executor.Exec(args[1]);
  return "^";
});
regOp("<-", 0, true, async (ctx, args) => {
  let targetBlock = Ch.VarExist(ctx.block, args[1]);
  if (Executor.Blocks.includes(targetBlock))
    await OPs["->"].Do({ block: targetBlock }, [args[0], ctx.block]);
  return "^";
});

// Списки
regOp(",", 1, true, async (ctx, args) => {
  let lst = [args[0]];
  if (Array.isArray(args[1])) lst.push(...args[1]);
  else lst.push(args[1]);
  return lst;
});
regOp("..", 15, true, async (ctx, args) => {
  let start = parseInt(Ch.VarExist(ctx.block, args[0])),
    end = parseInt(Ch.VarExist(ctx.block, args[1]));
  let res = [];
  for (let i = start; i <= end; i++) res.push(i);
  return res;
});
regOp("len", 6, false, async (ctx, args) => {
  let op = Ch.VarExist(ctx.block, args[0]);
  return Array.isArray(op) ? op.length : String(op).length;
});
regOp(
  "at",
  5,
  true,
  async (ctx, args) =>
    Ch.VarExist(ctx.block, args[1])[parseInt(Ch.VarExist(ctx.block, args[0]))],
);
regOp("lastof", 5, false, async (ctx, args) => {
  let list = Ch.VarExist(ctx.block, args[0]);
  return list[list.length - 1];
});
regOp("[+]", 0, true, async (ctx, args) => {
  let list = Ch.VarExist(ctx.block, args[1]);
  list.push(Ch.VarExist(ctx.block, args[0]));
  Executor.MemoryOfBlocks[ctx.block].variables[args[1]] = new Variable(list);
  return "^";
});
regOp("[-]", 0, true, async (ctx, args) => {
  let list = Ch.VarExist(ctx.block, args[1]);
  let val = Ch.VarExist(ctx.block, args[0]);
  let idx = list.indexOf(val);
  if (idx !== -1) list.splice(idx, 1);
  Executor.MemoryOfBlocks[ctx.block].variables[args[1]] = new Variable(list);
  return "^";
});
regOp("-=]", 0, true, async (ctx, args) => {
  let list = Ch.VarExist(ctx.block, args[1]);
  list.splice(parseInt(Ch.VarExist(ctx.block, args[0])), 1);
  Executor.MemoryOfBlocks[ctx.block].variables[args[1]] = new Variable(list);
  return "^";
});

// Утилиты
regOp("del", 0, false, async (ctx, args) => {
  let vars = Array.isArray(args[0]) ? args[0] : [args[0]];
  for (let v of vars) delete Executor.MemoryOfBlocks[ctx.block].variables[v];
});
regOp("import", 0, false, async (ctx, args) => {
  let file = String(Ch.VarExist(ctx.block, args[0]));
  let code = VirtualFS.files[file];
  if (code !== undefined) {
    let parsed = Parser.Parse(Lexer.Tokenize(KiiBlockFinder.FindIn(code)));
    Executor.Init(parsed);
    Executor.ImportedFiles.add(file);
  } else throw new Error("K0005");
});
regOp(
  ".",
  15,
  true,
  async (ctx, args) =>
    `${Ch.VarExist(ctx.block, args[0])} ${Ch.VarExist(ctx.block, args[1])}`,
);

/** ==========================================
 *  Лексер и Парсер
 *  ========================================== */
class KiiBlockFinder {
  static FindIn(code) {
    let result = { main: [] };
    let currentBlock = "main";
    for (let line of code.replace(/\r/g, "").split("\n")) {
      line = line.trim();
      if (!line || line.startsWith("//")) continue;
      if (line.endsWith(":")) {
        currentBlock = line.slice(0, -1);
        if (!result[currentBlock]) result[currentBlock] = [];
      } else result[currentBlock].push(line);
    }
    return result;
  }
}

class Lexer {
  static Tokenize(blocks) {
    let result = {};
    for (let block in blocks) {
      result[block] = [];
      for (let line of blocks[block]) {
        let tokens = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        for (let t of tokens) {
          if (t.startsWith('"') && t.endsWith('"'))
            result[block].push({
              type: "String",
              content: t.slice(1, -1).replace(/\\n/g, "\n"),
            });
          else if (t.includes(",") && t !== ",") {
            result[block].push({
              type: "Identifier",
              content: t.replace(/,/g, ""),
            });
            result[block].push({ type: "Operator", content: "," });
          } else if (OPs[t])
            result[block].push({ type: "Operator", content: t });
          else result[block].push({ type: "Identifier", content: t });
        }
        result[block].push({ type: "EndLine", content: ";" });
      }
    }
    return result;
  }
}

class SingleExpression {
  constructor(val) {
    this.val = val;
  }
  async Do(ctx) {
    return this.val;
  }
}
class Expression {
  constructor(op, one, two = null) {
    this.op = op;
    this.one = one;
    this.two = two;
  }
  async Do(ctx) {
    if (this.two)
      return await OPs[this.op].Do(ctx, [
        await this.one.Do(ctx),
        await this.two.Do(ctx),
      ]);
    return await OPs[this.op].Do(ctx, [await this.one.Do(ctx)]);
  }
}

class Parser {
  static Parse(tokenBlocks) {
    let ast = {};
    for (let b in tokenBlocks) {
      ast[b] = [];
      let tokens = tokenBlocks[b];
      let pos = 0;
      while (pos < tokens.length) {
        if (tokens[pos].type === "EndLine") {
          pos++;
          continue;
        }
        let lineTokens = [];
        while (pos < tokens.length && tokens[pos].type !== "EndLine") {
          lineTokens.push(tokens[pos]);
          pos++;
        }
        if (lineTokens.length > 0) ast[b].push(Parser.ParseLine(lineTokens));
      }
    }
    return ast;
  }
  static ParseLine(tokens) {
    if (tokens.length === 0) return null;
    if (tokens.length === 1) return new SingleExpression(tokens[0].content);
    let minPriority = 999,
      opIndex = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === "Operator") {
        let p = OPs[tokens[i].content].priority;
        if (p <= minPriority) {
          minPriority = p;
          opIndex = i;
        }
      }
    }
    if (opIndex === -1) return new SingleExpression(tokens[0].content);
    let op = tokens[opIndex].content,
      isBin = OPs[op].isBinary;
    if (isBin)
      return new Expression(
        op,
        Parser.ParseLine(tokens.slice(0, opIndex)) || new SingleExpression(""),
        Parser.ParseLine(tokens.slice(opIndex + 1)),
      );
    else return new Expression(op, Parser.ParseLine(tokens.slice(opIndex + 1)));
  }
}

/** ==========================================
 *  Executor (Движок)
 *  ========================================== */
class Executor {
  static Blocks = [];
  static MemoryOfBlocks = {};
  static AllTheBlocks = {};
  static ImportedFiles = new Set();
  static BlocksInUse = new Set();

  static Init(expressions) {
    for (let key in expressions) this.AllTheBlocks[key] = expressions[key];
    for (let key in expressions)
      if (!this.Blocks.includes(key)) this.Blocks.push(key);
    for (let key of this.Blocks)
      if (!this.MemoryOfBlocks[key]) this.MemoryOfBlocks[key] = new Memory();
  }

  static ReInit(expressions) {
    this.AllTheBlocks = expressions;
    this.Blocks = Object.keys(expressions);
    this.MemoryOfBlocks = {};
    for (let key of this.Blocks) this.MemoryOfBlocks[key] = new Memory();
  }

  static async Exec(block) {
    if (this.Blocks.includes(`pre-${block}`)) await this.Exec(`pre-${block}`);
    this.BlocksInUse.add(block);
    let ctx = { block: block };
    for (let i = 0; i < this.AllTheBlocks[block].length; i++) {
      try {
        await this.AllTheBlocks[block][i].Do(ctx);
      } catch (ex) {
        if (ex.message === "EXIT") throw ex;
        Terminal.println(
          `\n[ERROR] ${ex.message || "Unknown error"} at line ${i + 1} of block [${block}]`,
        );
        throw ex;
      }
    }
    if (!block.startsWith("crate-")) this.MemoryOfBlocks[block].Clean();
    this.BlocksInUse.delete(block);
  }

  static async Launch() {
    if (this.Blocks.includes("main")) {
      try {
        await this.Exec("main");
      } catch (e) {
        if (e.message !== "EXIT") console.error(e);
      }
    } else Terminal.println("K0003: No main block found.");
  }
}

// Запуск
document
  .getElementById("clear-btn")
  .addEventListener("click", () => Terminal.clear());
document.getElementById("run-btn").addEventListener("click", async () => {
  Terminal.clear();
  try {
    let code = VirtualFS.files["main.kii"] || "";
    let rawTokens = Lexer.Tokenize(KiiBlockFinder.FindIn(code));
    let ast = Parser.Parse(rawTokens);
    Executor.ReInit(ast);
    await Executor.Launch();
    Terminal.println("\n[Program finished]");
  } catch (e) {
    Terminal.println("\n[Fatal Execution Error]");
  }
});
