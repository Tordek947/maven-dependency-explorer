// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as cp from "child_process";
const fs = require("fs");
var dot = require("graphlib-dot");

const execShell = (cmd: string, currentWorkspace: vscode.Uri) =>
  new Promise<string>((resolve, reject) => {
    cp.exec(cmd, {cwd: currentWorkspace.fsPath}, (err, out) => {
      if (err) {
        return reject(err);
      }
      return resolve(out);
    });
  });

function updateGrpah(index: any, data: any) {
  const key = index;

  Object.keys(data).forEach((res) => {
    if (data[res][key] !== undefined) {
      data[res][key] = data[key];
    }
  });
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Track currently webview panel
  let currentPanel: vscode.WebviewPanel | undefined = undefined;

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated

  let disposableExplorer = vscode.commands.registerCommand(
    "maven-dependency-explorer.exploer",
    async () => {

      if (currentPanel) {
        const columnToShowIn = vscode.window.activeTextEditor?.viewColumn;
        // If we already have a panel, show it in the target column
        currentPanel.reveal(columnToShowIn);
        return;
      }

      const tempFile = vscode.Uri.joinPath(
        context.extensionUri,
        "dependency-tree.dot"
      ).fsPath;
      const currentDir =
        vscode.workspace?.workspaceFolders !== undefined
          ? vscode.workspace.workspaceFolders[0].uri
          : undefined;

      if (!currentDir?.fsPath) {
        vscode.window.showErrorMessage("Something went wrong!");
      }

      const mavenExecutableSettings = vscode.workspace.getConfiguration("maven.executable");
      const mavenExecutableOptions = mavenExecutableSettings.get<string>("options") || "";
      const preferMavenWrapper = mavenExecutableSettings.get<boolean>("preferMavenWrapper") || false;
      const pomLocation = vscode.Uri.joinPath(currentDir!, "pom.xml").fsPath;
      const mavenBinary = (preferMavenWrapper && fs.existsSync(vscode.Uri.joinPath(currentDir!, "mvnw").fsPath))
        ? "./mvnw"
        : "mvn";

      currentPanel = vscode.window.createWebviewPanel(
        "openWebview", // Identifies the type of the webview. Used internally
        "POM Explorer", // Title of the panel displayed to the user
        vscode.ViewColumn.One, // Editor column to show the new webview panel in.
        {
          // Enable scripts in the webview
          enableScripts: true, //Set this to true if you want to enable Javascript.
        }
      );

      currentPanel.webview.html = getWebviewContent(
        currentPanel.webview,
        context.extensionUri
      );

      try {
        await execShell(
          `${mavenBinary} ${mavenExecutableOptions} -f ${pomLocation} dependency:tree -DoutputFile=${tempFile} -DoutputType=dot`,
          currentDir!
        );

        var digraph = dot.read(fs.readFileSync(tempFile, "UTF-8"));

        let graph: any = {};

        digraph.edges().forEach((edge: any) => {
          const w = edge.w;
          graph[edge.v] = graph[edge.v]
            ? { ...graph[edge.v], [w]: {} }
            : { [w]: {} };
        });

        Object.keys(graph)
          .reverse()
          .forEach(function (index) {
            updateGrpah(index, graph);
          });

        currentPanel.webview.postMessage(graph);

        currentPanel.onDidChangeViewState(
          (e) => e.webviewPanel.webview.postMessage(graph),
          null,
          context.subscriptions
        );

        currentPanel.onDidDispose(
          () => {
            currentPanel = undefined;
            fs.unlink(tempFile, (e: Error) => {
              if (e) {
                vscode.window.showErrorMessage(`${e}`);
              }
            });
          },
          null,
          context.subscriptions
        );
      } catch (e) {
        vscode.window.showErrorMessage(`${e}`);
        currentPanel.dispose();
        return;
      }
    }
  );

  context.subscriptions.push(disposableExplorer);
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
  const styles = vscode.Uri.joinPath(extensionUri, "media", "css", "style.css");
  const stylesURI = webview.asWebviewUri(styles);

  const bootstrapStyle = vscode.Uri.joinPath(
    extensionUri,
    "media",
    "css",
    "bootstrap.min.css"
  );
  const bootstrapStyleURI = webview.asWebviewUri(bootstrapStyle);

  const script = vscode.Uri.joinPath(extensionUri, "media", "script.js");
  const scriptUri = webview.asWebviewUri(script);

  const nonce = getNonce();

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, shrink-to-fit=no"
    />
    <link href="${bootstrapStyleURI}" rel="stylesheet">
    <link href="${stylesURI}" rel="stylesheet">

    <title>Maven Dependency Explorer</title>
  </head>
  <body style="padding:0px;">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <a class="navbar-brand" href="#">Maven Dependency Explorer</a>

    <div class="collapse navbar-collapse" id="navbarSupportedContent">
    <ul class="navbar-nav mr-auto">
       <li class="nav-item ml-5">
          <button type="button" class="btn btn-primary" id="expand">
            Expand
          </button>
        </li>
      
        <li class="nav-item ml-3">
          <button type="button" class="btn btn-primary" id="collapse">
            Collapse
          </button>
        </li>
      </ul> 
      <div class="form-inline my-2 my-lg-0">
        <input
        class="form-control mr-sm-2"
        type="search"
        placeholder="Search"
        id="input"
      />
      </div>
    </div>
  </nav>

  <br />
  <div class="container-fluid">

    <div id="spinner">
        <div class="spinner-grow" style="width: 5rem; height: 5rem;">
          <span class="sr-only">Loading...</span>
        </div>
      </div>
    <div class="row">
      <div class="col">
        <ul id="graph" class="list-group"></ul>
      </div>
      <div class="col">
        <ul id="listitem" class="list-group"></ul>
      </div>
    </div>
  </div>
	   <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
  </html>`;
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// this method is called when your extension is deactivated
export function deactivate() {}
