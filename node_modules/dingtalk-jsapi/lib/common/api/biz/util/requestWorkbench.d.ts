export declare const apiName = "biz.util.requestWorkbench";
/**
 * 对妙聚窗口执行动作比如刷新、独立、嵌套或者配置描述 请求参数定义
 * @apiName biz.util.requestWorkbench
 */
export interface IBizUtilRequestWorkbenchParams {
    /** 请求类型，refresh，detach， attach, config */
    requestType: string;
    /** 需要发起请求的妙聚窗口对象的id */
    configTarget?: string;
    /** 窗口独立的方式，wndDetach，toCspace */
    detachType?: string;
    /** 本地入口打开的方式，alone, embed, tocspace */
    natvieOpenType?: string;
    /** 只有一个标签时是否自动隐藏标签栏 */
    autoHideHeader?: boolean;
    /** 是否启用历史记录 */
    isEnableHistory?: boolean;
    /** 独立窗口时的标题 */
    frameTitle?: string;
    /** 新建按钮的行为定义 */
    newBtnUrl?: string;
    /** 新建按钮的 tooltip */
    newBtnTooltip?: string;
    /** 新建按钮打开的标签类型 */
    newBtnTabAppType?: string;
    /** 首页的 url 定义 */
    homeTabUrl?: string;
    /** 首页打开的标签类型 */
    homeTabAppType?: string;
}
/**
 * 对妙聚窗口执行动作比如刷新、独立、嵌套或者配置描述 返回结果定义
 * @apiName biz.util.requestWorkbench
 */
export interface IBizUtilRequestWorkbenchResult {
}
/**
 * 对妙聚窗口执行动作比如刷新、独立、嵌套或者配置描述
 * @apiName biz.util.requestWorkbench
 * @supportVersion win: 6.0.8 mac: 6.0.8
 * @author win: 周镛, mac: 伯温
 */
export declare function requestWorkbench$(params: IBizUtilRequestWorkbenchParams): Promise<IBizUtilRequestWorkbenchResult>;
export default requestWorkbench$;
