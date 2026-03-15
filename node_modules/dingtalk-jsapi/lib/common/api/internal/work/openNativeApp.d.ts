export declare const apiName = "internal.work.openNativeApp";
/**
 * 功能描述PC工作台打开特定应用功能（如钉邮，钉盘） 请求参数定义
 * @apiName internal.work.openNativeApp
 */
export interface IInternalWorkOpenNativeAppParams {
    /** 目前支持钉盘（"-3"），钉邮（"-5"） */
    appId: string;
    option: any;
}
/**
 * 功能描述PC工作台打开特定应用功能（如钉邮，钉盘） 返回结果定义
 * @apiName internal.work.openNativeApp
 */
export interface IInternalWorkOpenNativeAppResult {
}
/**
 * 功能描述PC工作台打开特定应用功能（如钉邮，钉盘）
 * @apiName internal.work.openNativeApp
 * @supportVersion ios: 4.7.10 android: 4.7.10
 * @author Windows: 伏檀, Mac: 口合
 */
export declare function openNativeApp$(params: IInternalWorkOpenNativeAppParams): Promise<IInternalWorkOpenNativeAppResult>;
export default openNativeApp$;
