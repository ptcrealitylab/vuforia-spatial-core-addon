# Vuforia Spatial Edge Server Code Add-on

This is the core-addon for the Vuforia Spatial Edge Server. It provides a
baseline set of blocks, interfaces, nodes, and tools to the Edge Server. The
server loads code from blocks, interfaces, and nodes. The editor user interface
loads blocks, nodes, and tools.

## Add-on Content Types

### Blocks

Logic blocks available in the data crafting board.

### Interfaces

Hardware interfaces which translate between the hardwareInterface.js API and
the hardware.

### Nodes

Programming nodes associated with an object that can produce and consume
values.

### Tools

Tools which the user can place on objects or float in world space to provide
useful interactions.

### Content Scripts

Low-level scripts placed directly into the user interface's context as if they
were part of the editor's code.


## Examples

This repo contains examples for blocks, interfaces, nodes, and tools. Content
scripts are more niche but a simple "hello world" example looks like this:

```javascript
(function() {
    function initService() {
        let messageDiv = document.createElement('div');
        messageDiv.style.position = 'absolute';
        messageDiv.style.left = 0;
        messageDiv.style.top = 0;
        messageDiv.style.fontFamily = 'sans-serif';
        messageDiv.style.fontSize = '12px';
        messageDiv.style.color = 'cyan';
        messageDiv.style.pointerEvents = 'none';
        messageDiv.textContent = 'Hello world!';

        document.body.appendChild(messageDiv);
    }

    realityEditor.addons.addCallback('init', initService);
}());
```
