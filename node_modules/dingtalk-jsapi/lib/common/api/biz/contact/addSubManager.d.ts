export declare const apiName = "biz.contact.addSubManager";
/**
 * 跳转到添加子管理员界面 请求参数定义
 * @apiName biz.contact.addSubManager
 */
export interface IBizContactAddSubManagerParams {
    [key: string]: any;
}
/**
 * 跳转到添加子管理员界面 返回结果定义
 * @apiName biz.contact.addSubManager
 */
export interface IBizContactAddSubManagerResult {
    [key: string]: any;
}
/**
 * 跳转到添加子管理员界面
 * @apiName biz.contact.addSubManager
 * @supportVersion  ios: 4.2.5 android: 4.2.5
 */
export declare function addSubManager$(params: IBizContactAddSubManagerParams): Promise<IBizContactAddSubManagerResult>;
export default addSubManager$;
