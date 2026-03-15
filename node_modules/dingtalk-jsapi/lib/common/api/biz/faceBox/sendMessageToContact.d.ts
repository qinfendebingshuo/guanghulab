export declare const apiName = "biz.faceBox.sendMessageToContact";
/**
 *  发送消息 请求参数定义
 * @apiName biz.faceBox.sendMessageToContact
 */
export interface IBizFaceBoxSendMessageToContactParams {
    [key: string]: any;
}
/**
 *  发送消息 返回结果定义
 * @apiName biz.faceBox.sendMessageToContact
 */
export interface IBizFaceBoxSendMessageToContactResult {
    [key: string]: any;
}
/**
 *  发送消息
 * @apiName biz.faceBox.sendMessageToContact
 * @supportVersion  ios: 4.2.8 android: 4.2.8
 */
export declare function sendMessageToContact$(params: IBizFaceBoxSendMessageToContactParams): Promise<IBizFaceBoxSendMessageToContactResult>;
export default sendMessageToContact$;
