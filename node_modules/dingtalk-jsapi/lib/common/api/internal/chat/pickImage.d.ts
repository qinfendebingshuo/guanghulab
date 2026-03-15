export declare const apiName = "internal.chat.pickImage";
/**
 * 选图组件，选图和上传分开，可以让前端选完图然后再异步上传, 由于移动端H5还不能通过loc.dingtalk.com拦截请求， 所以增加一个jsapi获取base64(thumbData) 请求参数定义
 * @apiName internal.chat.pickImage
 */
export interface IInternalChatPickImageParams {
    maxCnt: number;
}
/**
 * 选图组件，选图和上传分开，可以让前端选完图然后再异步上传, 由于移动端H5还不能通过loc.dingtalk.com拦截请求， 所以增加一个jsapi获取base64(thumbData) 返回结果定义
 * @apiName internal.chat.pickImage
 */
export declare type IInternalChatPickImageResult = Array<{
    localMediaId: string;
    width: number;
    height: number;
    picType: number;
    orientation: number;
}>;
/**
 * 选图组件，选图和上传分开，可以让前端选完图然后再异步上传, 由于移动端H5还不能通过loc.dingtalk.com拦截请求， 所以增加一个jsapi获取base64(thumbData)
 * @apiName internal.chat.pickImage
 * @supportVersion ios: 4.7.5 android: 4.7.5
 */
export declare function pickImage$(params: IInternalChatPickImageParams): Promise<IInternalChatPickImageResult>;
export default pickImage$;
