// --- ДОБАВЬ ЭТО В КОНЕЦ script.js ДЛЯ РАБОТЫ МОБИЛЬНОГО МЕНЮ --- //

document.getElementById("mobile-menu-btn").addEventListener("click", () => {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("open");
});

// Закрывать меню при клике по файлу на телефоне
function openTab(filename) {
  if (!VirtualFS.openTabs.includes(filename)) VirtualFS.openTabs.push(filename);
  switchToTab(filename);

  // Прячем сайдбар на мобилках после выбора файла
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.remove("open");
  }
}

/** ==========================================
 *  IDE UI & SYNTAX HIGHLIGHTING
 *  ========================================== */

CodeMirror.defineSimpleMode("kiilang", {
  start: [
    { regex: /"(?:[^\\]|\\.)*?(?:"|$)/, token: "string" },
    {
      regex:
        /\b(?:out|outln|print|println|in|run|runif|loop|equit|del|import|unimport|reload|at|lastof|len|unload)\b/,
      token: "keyword",
    },
    { regex: /\b(?:true|false)\b/, token: "atom" },
    { regex: /\b\d+(\.\d+)?\b/, token: "number" },
    { regex: /[a-zA-Z0-9_-]+(?=:)/, token: "def" },
    { regex: /:/, token: "punctuation" },
    {
      regex:
        /->|=>|<-|#=|==|!=|>=|<=|\+=|-=|\*=|\/=|\[\+\]|\[-\]|-=\]|\.\.|\.|>|<|&&|\|\||[+\-*\/=!|=]/,
      token: "operator",
    },
    { regex: /\/\/.*/, token: "comment" },
    { regex: /[a-zA-Z_][\w]*/, token: "variable" },
  ],
  meta: { lineComment: "//" },
});

const VirtualFS = {
  files: {
    "main.kii":
      'main:\nprint 2 + 3 - 5 * 7 / 2 + 3 * a = 10\nprintln ""\nprintln a',
  },
  openTabs: ["main.kii"],
  activeFile: "main.kii",
};

const editor = CodeMirror(document.getElementById("editor-container"), {
  theme: "retro-purple",
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
    li.innerHTML = `<span>${file}</span> <span class="delete-file" title="Delete" onclick="deleteFile(event, '${file}')">×</span>`;
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
  } else renderTabs();
}

function deleteFile(e, filename) {
  e.stopPropagation();
  if (filename === "main.kii") return alert("main.kii cannot be deleted!");
  delete VirtualFS.files[filename];
  closeTab(e, filename);
  renderExplorer();
}

document.getElementById("add-file-btn").addEventListener("click", () => {
  let name = prompt("File name:", "module.kii");
  if (name && !VirtualFS.files[name]) {
    VirtualFS.files[name] = "";
    renderExplorer();
    openTab(name);
  }
});

switchToTab("main.kii");

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
    document.getElementById("terminal-pane").scrollTop =
      document.getElementById("terminal-pane").scrollHeight;
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
 *  KIILANG ENGINE (100% C# PORT)
 *  ========================================== */

const ParserHelper = {
  ops: { "=": true, "-": true, len: false, "==": true, runif: true },
};
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
    for (let key in this.variables)
      if (!this.variables[key].isStatic) delete this.variables[key];
  }
}

class Ch {
  static VarExist(block, name) {
    if (
      typeof name === "string" &&
      Executor.MemoryOfBlocks[block]?.variables[name]
    )
      return Executor.MemoryOfBlocks[block].variables[name].Get();
    if (name === "true") return true;
    if (name === "false") return false;
    return name;
  }
}

const OPs = {};
function regOp(sign, priority, isBinary, action) {
  OPs[sign] = { sign, priority, isBinary, Do: action };
}

// Utils to simulate C# Convert.ToInt32 throwing K0002
function getInt(ctx, arg) {
  let v = parseInt(Ch.VarExist(ctx.block, arg));
  if (isNaN(v)) throw new Error("K0002");
  return v;
}

// Math Operators (Strict C# throwing behavior)
regOp("*", 5, true, async (ctx, args) => {
  let x = 1;
  for (let y of args) x *= getInt(ctx, y);
  return x;
});
regOp("/", 5, true, async (ctx, args) =>
  Math.floor(getInt(ctx, args[0]) / getInt(ctx, args[1])),
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
    let x = 0;
    for (let y of args) x += getInt(ctx, y);
    return x;
  } catch {
    return args.map((y) => Ch.VarExist(ctx.block, y)).join("");
  }
});
regOp(
  "-",
  4,
  true,
  async (ctx, args) => getInt(ctx, args[0]) - getInt(ctx, args[1]),
);

// Logic & Assign
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
  async (ctx, args) => getInt(ctx, args[0]) > getInt(ctx, args[1]),
);
regOp(
  "<",
  3,
  true,
  async (ctx, args) => getInt(ctx, args[0]) < getInt(ctx, args[1]),
);
regOp(
  ">=",
  3,
  true,
  async (ctx, args) => getInt(ctx, args[0]) >= getInt(ctx, args[1]),
);
regOp(
  "<=",
  3,
  true,
  async (ctx, args) => getInt(ctx, args[0]) <= getInt(ctx, args[1]),
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

regOp("=", 0, true, async (ctx, args) => {
  let val = Ch.VarExist(ctx.block, args[1]);
  Executor.MemoryOfBlocks[ctx.block].variables[String(args[0])] = new Variable(
    val,
  );
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
  mem[args[0]].Set(parseInt(mem[args[0]].Get()) - getInt(ctx, args[1]));
});
regOp("*=", 0, true, async (ctx, args) => {
  let mem = Executor.MemoryOfBlocks[ctx.block].variables;
  mem[args[0]].Set(parseInt(mem[args[0]].Get()) * getInt(ctx, args[1]));
});
regOp("/=", 0, true, async (ctx, args) => {
  let mem = Executor.MemoryOfBlocks[ctx.block].variables;
  mem[args[0]].Set(
    Math.floor(parseInt(mem[args[0]].Get()) / getInt(ctx, args[1])),
  );
});

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
      await Executor.Exec(args[1]);
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

regOp(",", 1, true, async (ctx, args) => {
  let lst = [args[0]];
  if (Array.isArray(args[1])) lst.push(...args[1]);
  else lst.push(args[1]);
  return lst;
});
regOp("..", 15, true, async (ctx, args) => {
  let start = getInt(ctx, args[0]),
    end = getInt(ctx, args[1]);
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
  async (ctx, args) => Ch.VarExist(ctx.block, args[1])[getInt(ctx, args[0])],
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
  list.splice(getInt(ctx, args[0]), 1);
  Executor.MemoryOfBlocks[ctx.block].variables[args[1]] = new Variable(list);
  return "^";
});

regOp("del", 0, false, async (ctx, args) => {
  let vars = Array.isArray(args[0]) ? args[0] : [args[0]];
  for (let v of vars) delete Executor.MemoryOfBlocks[ctx.block].variables[v];
});
regOp("import", 0, false, async (ctx, args) => {
  let file = String(Ch.VarExist(ctx.block, args[0]));
  let code = VirtualFS.files[file];
  if (code !== undefined) {
    let parsed = Parser.Prioritize(
      Parser.Parse(
        Lexer.Tokenize2(Lexer.RawTokenize(KiiBlockFinder.FindIn(code))),
      ),
    );
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
  static RawTokenize(blocks) {
    let result = {};
    for (let key in blocks) {
      result[key] = [];
      for (let line of blocks[key]) {
        let contents = "",
          writingString = false;
        for (let i = 0; i < line.length; i++) {
          let symbol = line[i];
          if (symbol === '"') {
            if (writingString) {
              if (line[i - 1] !== "\\") {
                writingString = !writingString;
                result[key].push({
                  content: contents.replace(/\\n/g, "\n"),
                  type: "String",
                });
                contents = "";
              } else contents += '"';
            } else writingString = true;
          } else if (symbol === " ") {
            if (!writingString) {
              if (contents.trim() !== "") {
                result[key].push({ content: contents, type: "Identifier" });
                contents = "";
              }
            } else contents += " ";
          } else if (symbol === ".") {
            if (!writingString) {
              if (contents.trim() !== "") {
                result[key].push({ content: contents, type: "Identifier" });
                contents = "";
              }
              result[key].push({ content: ".", type: "Operator" });
            } else contents += ".";
          } else contents += symbol;
        }
        if (contents !== "" && contents !== "\0" && contents !== "\r") {
          if (!writingString)
            result[key].push({ content: contents, type: "Identifier" });
          else
            result[key].push({
              content: contents.replace(/\\n/g, "\n"),
              type: "String",
            });
        }
        result[key].push({ content: ";", type: "EndLine" });
      }
    }
    return result;
  }
  static Tokenize2(raw) {
    let result = {};
    for (let key in raw) {
      result[key] = [];
      for (let token of raw[key]) {
        let newToken = { ...token };
        if (OPs[newToken.content] && newToken.type !== "String")
          newToken.type = "Operator";
        else {
          let isBlockReference = Object.keys(raw).some((x) =>
            newToken.content.includes(x),
          );
          if (isBlockReference) newToken.type = "BlockReference";
        }
        if (!isNaN(newToken.content) && newToken.content.trim() !== "")
          newToken.type = "Integer";

        if (newToken.content.includes(",") && newToken.type !== "String") {
          newToken.content = newToken.content.replace(/,/g, "");
          result[key].push(newToken);
          result[key].push({ content: ",", type: "Operator" });
        } else if (
          newToken.content.includes("..") &&
          newToken.type !== "String" &&
          newToken.type !== "Operator"
        ) {
          newToken.content = newToken.content.replace(/\.\./g, " ");
          let split = newToken.content.split(" ").filter(Boolean);
          if (split.length === 2) {
            result[key].push({ content: split[0], type: "Identifier" });
            result[key].push({ content: "..", type: "Operator" });
            result[key].push({ content: split[1], type: "Identifier" });
          } else {
            result[key].push(newToken);
            result[key].push({ content: "..", type: "Operator" });
          }
        } else {
          if (newToken.content !== "") result[key].push(newToken);
        }
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
  constructor(one, two, op) {
    this.one = one;
    this.two = two;
    this.op = op;
  }
  async Do(ctx) {
    try {
      return await this.op.Do(ctx, [
        await this.one.Do(ctx),
        await this.two.Do(ctx),
      ]);
    } catch (ex) {
      return await this.op.Do(ctx, [await this.one.Do(ctx)]);
    }
  }
}

class Parser {
  static Prioritize(box) {
    let result = {};
    for (let key in box) {
      result[key] = [];
      for (let item of box[key]) {
        if (item.one instanceof Expression) {
          if (item.op.priority === 0)
            result[key].push(
              new Expression(Parser.Pri(item.one), item.two, item.op),
            );
          else {
            let _new = Parser.Pri(item),
              limit = 0;
            while (_new.op && _new.op.priority !== 0 && limit++ < 50)
              _new = Parser.Pri(_new);
            result[key].push(_new);
          }
        } else if (item.two instanceof Expression) {
          if (item.op.priority === 0)
            result[key].push(
              new Expression(item.one, Parser.Pri(item.two), item.op),
            );
          else {
            let _new = Parser.Pri(item),
              limit = 0;
            while (_new.op && _new.op.priority !== 0 && limit++ < 50)
              _new = Parser.Pri(_new);
            result[key].push(_new);
          }
        } else result[key].push(item);
      }
    }
    return result;
  }

  static Pri(base) {
    let newExpr = new Expression(base.one, base.two, base.op);
    try {
      if (base.one instanceof Expression) {
        try {
          if (base.op.priority > base.one.op.priority) {
            let smallNode = base.two.one,
              bigNode = base.two;
            newExpr.op = bigNode.op;
            newExpr.one = new Expression(base.one, smallNode, base.op);
            newExpr.two = bigNode.two;
          } else if (newExpr.two instanceof Expression)
            newExpr.two = Parser.Pri(newExpr.two);
        } catch (ex) {
          if (base.op.priority > base.one.op.priority) {
            let smallNode = base.one.one,
              bigNode = base.one;
            newExpr.op = bigNode.op;
            newExpr.one = new Expression(
              smallNode,
              new SingleExpression(0),
              base.op,
            );
            newExpr.two = bigNode.two;
          }
        }
      }
      if (base.two instanceof Expression) {
        if (base.op.priority > base.two.op.priority) {
          let smallNode = base.two.one,
            bigNode = base.two;
          newExpr.op = bigNode.op;
          newExpr.one = new Expression(base.one, smallNode, base.op);
          newExpr.two = bigNode.two;
        } else if (newExpr.two instanceof Expression)
          newExpr.two = Parser.Pri(newExpr.two);
      }
    } catch (ex) {}
    return newExpr;
  }

  static Parse(box) {
    let result = {};
    for (let key in box) {
      result[key] = [];
      for (let i = 0; i < box[key].length; i++) {
        if (box[key][i].type !== "EndLine") {
          if (i + 1 < box[key].length && box[key][i + 1].type !== "EndLine") {
            let ref = { i };
            result[key].push(Parser.Expr(ref, box[key]));
            i = ref.i;
          }
        }
      }
    }
    return result;
  }

  static Expr(ref, box) {
    let newExpr = new Expression(),
      i = ref.i;
    let isBinary =
      ParserHelper.ops[box[i].content] !== undefined
        ? ParserHelper.ops[box[i].content]
        : box[i].type !== "Operator";
    let ti = i;
    if (isBinary) {
      i += 1;
      newExpr.one = new SingleExpression(box[i - 1].content);
      try {
        if (
          (box[i + 2] && box[i + 2].type === "Operator") ||
          (box[i + 1] && box[i + 1].type === "Operator")
        ) {
          ti = i;
          i += 1;
          ref.i = i;
          newExpr.two = Parser.Expr(ref, box);
          i = ref.i;
        } else if (box[i + 2] && box[i + 2].type === "EndLine") {
          newExpr.two = new SingleExpression(box[i + 1].content);
          ti = i;
        }
      } catch (e) {}
    } else {
      try {
        if (box[i + 2] && box[i + 2].type === "Operator") {
          ti = i;
          i += 1;
          ref.i = i;
          newExpr.one = Parser.Expr(ref, box);
          i = ref.i;
        } else if (box[i + 1] && box[i + 1].type === "Operator") {
          ti = i;
          i += 1;
          ref.i = i;
          newExpr.one = Parser.Expr(ref, box);
          i = ref.i;
        } else newExpr.one = new SingleExpression(box[i + 1].content);
      } catch (e) {}
    }
    newExpr.op = OPs[box[ti].content] || OPs["+"];
    ref.i = i;
    return newExpr;
  }
}

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

document
  .getElementById("clear-btn")
  .addEventListener("click", () => Terminal.clear());
document.getElementById("run-btn").addEventListener("click", async () => {
  Terminal.clear();
  try {
    let code = VirtualFS.files["main.kii"] || "";
    let rawTokens = Lexer.RawTokenize(KiiBlockFinder.FindIn(code));
    let tokens2 = Lexer.Tokenize2(rawTokens);
    let ast = Parser.Prioritize(Parser.Parse(tokens2));
    Executor.ReInit(ast);
    await Executor.Launch();
    Terminal.println("\n[Program finished]");
  } catch (e) {
    Terminal.println("\n[Fatal Execution Error]");
  }
});

// --- ЛОГИКА МОДАЛЬНОГО ОКНА INFO --- //
const infoBtn = document.getElementById("info-btn");
const infoModal = document.getElementById("info-modal");
const closeModalBtn = document.getElementById("close-modal-btn");

// Открыть окно
infoBtn.addEventListener("click", () => {
  infoModal.style.display = "flex";
});

// Закрыть по кнопке [X]
closeModalBtn.addEventListener("click", () => {
  infoModal.style.display = "none";
});

// Закрыть по клику на темный фон вокруг окна
window.addEventListener("click", (e) => {
  if (e.target === infoModal) {
    infoModal.style.display = "none";
  }
});
