const checkIfWebGLSupported = () => {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
}

export { checkIfWebGLSupported };