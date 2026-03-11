export declare const apiName = "internal.chat.getPickedImageThumbData";
/**
 * 由于移动端H5还不能通过loc.dingtalk.com拦截请求，所以增加一个jsapi获取base64(thumbData) 请求参数定义
 * @apiName internal.chat.getPickedImageThumbData
 */
export interface IInternalChatGetPickedImageThumbDataParams {
    /** localMediaId, pickImage接口里返回 */
    localMediaId: string;
}
/**
 * 由于移动端H5还不能通过loc.dingtalk.com拦截请求，所以增加一个jsapi获取base64(thumbData) 返回结果定义
 * @apiName internal.chat.getPickedImageThumbData
 */
export declare type IInternalChatGetPickedImageThumbDataResult = string;
/**
 * 由于移动端H5还不能通过loc.dingtalk.com拦截请求，所以增加一个jsapi获取base64(thumbData)
 * @apiName internal.chat.getPickedImageThumbData
 * @supportVersion ios: 4.7.5 android: 4.7.5
 */
export declare function getPickedImageThumbData$(params: IInternalChatGetPickedImageThumbDataParams): Promise<IInternalChatGetPickedImageThumbDataResult>;
export default getPickedImageThumbData$;
