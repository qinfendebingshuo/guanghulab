// 模块注册表
window.ModuleRegistry = {
    modules: {},
    
    register: function(name, module) {
        this.modules[name] = module;
        console.log(`[registry] 模块 ${name} 已注册`);
    },
    
    get: function(name) {
        return this.modules[name];
    },
    
    list: function() {
        return Object.keys(this.modules);
    }
};
