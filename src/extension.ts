// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';
const fs = require('fs');
var dot = require('graphlib-dot');

const execShell = (cmd: string) =>
  new Promise<string>((resolve, reject) => {
    cp.exec(cmd, (err, out) => {
      if (err) {
        return reject(err);
      }
      return resolve(out);
    });
  });

function updateGrpah(index: any, data: any) {
  const key = index;

  Object.keys(data).forEach((res) => {
    Object.keys(data[res])
      .filter((res1) => {
        return res1 === key;
      })
      .forEach((res2) => {
        data[res][key] = data[res2];
      });
  });
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated

  let disposableExplorer = vscode.commands.registerCommand(
    'maven-depencency-explorer.exploer',
    async () => {
      const tempFile = vscode.Uri.joinPath(
        context.extensionUri,
        'dependency-tree.dot'
      ).path;
      const currentDir =
        vscode.workspace?.workspaceFolders !== undefined
          ? vscode.workspace.workspaceFolders[0].uri.path
          : undefined;

      if (!currentDir) {
        vscode.window.showErrorMessage('Something went wrong!');
      }

      await execShell(
        `mvn -f ${currentDir}/pom.xml dependency:tree -DoutputFile=${tempFile} -DoutputType=dot`
      );

      var digraph = dot.read(fs.readFileSync(tempFile, 'UTF-8'));

      let graph: any = {};

      digraph.edges().forEach((edge: any) => {
        const w = edge.w;
        graph[edge.v] = graph[edge.v] ? {...graph[edge.v], [w]: {}} : {[w]: {}};
      });

      Object.keys(graph)
        .reverse()
        .forEach(function (index) {
          updateGrpah(index, graph);
        });
      const panel = vscode.window.createWebviewPanel(
        'openWebview', // Identifies the type of the webview. Used internally
        'Example Page', // Title of the panel displayed to the user
        vscode.ViewColumn.One, // Editor column to show the new webview panel in.
        {
          // Enable scripts in the webview
          enableScripts: true, //Set this to true if you want to enable Javascript.
        }
      );

      panel.webview.html = getWebviewContent(
        panel.webview,
        context.extensionUri
      );

      panel.webview.postMessage(graph);

      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage(
        'Hello World from maven-depencency-explorer!'
      );
    }
  );

  context.subscriptions.push(disposableExplorer);
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
  const styles = vscode.Uri.joinPath(extensionUri, 'media', 'style.css');
  const stylesURI = webview.asWebviewUri(styles);

  const script = vscode.Uri.joinPath(extensionUri, 'media', 'script.js');
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
    <link
      rel="stylesheet"
      href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css"
      integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T"
      crossorigin="anonymous"
    />
    <link href="${stylesURI}" rel="stylesheet">

    <title>Maven Dependency Explorer</title>
  </head>
  <body style="padding:0px;">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <a class="navbar-brand" href="#">Maven Dependency Explorer</a>

    <div class="collapse navbar-collapse" id="navbarSupportedContent">
    <!--  <ul class="navbar-nav mr-auto">
        <li class="nav-item ml-5">
          <button type="button" class="btn btn-primary" id="expand">
            Expand
          </button>
        </li>

        <li class="nav-item ml-2">
          <button type="button" class="btn btn-primary" id="collapse">
            Collapse
          </button>
        </li>
      </ul> -->
      <form class="form-inline my-2 my-lg-0">
        <input
          class="form-control mr-sm-2"
          type="search"
          placeholder="Search"
          id="input"
        />
      </form>
    </div>
  </nav>

  <br />
  <div class="container-fluid">
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
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// this method is called when your extension is deactivated
export function deactivate() {}