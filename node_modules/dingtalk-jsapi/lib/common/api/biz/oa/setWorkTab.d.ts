export declare const apiName = "biz.oa.setWorkTab";
/**
 * 配置用户用户企业工作台，设置自定义title和自定义主页链接，仅对管理员开放，如果当前用户不是设置企业的管理员，则报错 请求参数定义
 * @apiName biz.oa.setWorkTab
 */
export interface IBizOaSetWorkTabParams {
    [key: string]: any;
}
/**
 * 配置用户用户企业工作台，设置自定义title和自定义主页链接，仅对管理员开放，如果当前用户不是设置企业的管理员，则报错 返回结果定义
 * @apiName biz.oa.setWorkTab
 */
export interface IBizOaSetWorkTabResult {
    [key: string]: any;
}
/**
 * 配置用户用户企业工作台，设置自定义title和自定义主页链接，仅对管理员开放，如果当前用户不是设置企业的管理员，则报错
 * @apiName biz.oa.setWorkTab
 * @supportVersion  ios: 3.5.6 android: 3.5.6
 */
export declare function setWorkTab$(params: IBizOaSetWorkTabParams): Promise<IBizOaSetWorkTabResult>;
export default setWorkTab$;
