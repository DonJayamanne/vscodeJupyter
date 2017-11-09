# Jupyter

An extension with rich support for [Jupyter](http://jupyter.org/)  

## Quick Start
* Install the extension
* When using Python, install the [Microsoft Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python) as well. 
* Install [Jupyter](http://jupyter.org/install.html)  
  + You're ready to use it.

### Tested with Python and JavaScript Kernels (support for others coming soon)

## Sample Python usage  
* Create a Python file with the following text  

```python
#%%
import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np

x = np.linspace(0, 20, 100)
plt.plot(x, np.sin(x))
plt.show() 
```  
  
* Click on the code lens ```Run Cell```

## Run Cell Hot key as in Chrome
* If you want to run cell with Ctrl+Enter, add those code in keybindings.json.

```json
{ "key": "ctrl+enter",      "command": "jupyter.execCurrentCell",
                                  "when": "editorTextFocus"
}
```

## Remote Jupyter kernel on Server / Docker
Try this to connect to a remote Jupyter kernel running on a server, or inside Docker container:

1. Start a remote Jupyter Notebook or headless KernelGateway
1. Find the token in the output of the Jupyter server logs: http://jupyter-notebook.readthedocs.io/en/latest/security.html

Then in VS Code:
1. ctrl+shift+p
1. Jupyter: Enter the url of local/remote Jupyter Notebook


## [Documentation](https://github.com/DonJayamanne/vscodejupyter/wiki)
For further information and details continue through to the [documentation](https://github.com/DonJayamanne/vscodejupyter/wiki).

## [Issues, Feature Requests and Contributions](https://github.com/DonJayamanne/vscodejupyter/issues)
* Contributions are always welcome. Fork it, modify it and create a pull request.  
* Any and all feedback is appreciated and welcome.  

## [Roadmap](https://github.com/DonJayamanne/vscodeJupyter/wiki/Roadmap)

### Version 1.1.3 (5 May 2017)
* Notebook not detected [#46](https://github.com/DonJayamanne/vscodeJupyter/issues/46)

### Version 1.1.2 (24 April 2017)
* Fix high CPU usage [#40](https://github.com/DonJayamanne/vscodeJupyter/issues/40)

### Version 1.1.1 (13 April 2017)
* Bug fix (extension fails to load)  
* Increase timeout waiting for Jupyter Notebook to start  

### Version 1.1.0 (12 April 2017)
* Preliminary support for older versions of Jupyter Notebook (< 4.2.0)

![Scientific Tools](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/jupyter/examples.gif)


## Source
[GitHub](https://github.com/DonJayamanne/vscodejupyter)

                
## License
[MIT](https://raw.githubusercontent.com/DonJayamanne/vscodejupyter/master/LICENSE)
