export declare const apiName = "internal.chat.sendRichTextMessage";
/**
 * 发送富文本消息 请求参数定义
 * @apiName internal.chat.sendRichTextMessage
 */
export interface IInternalChatSendRichTextMessageParams {
    /** 会话id */
    cid: string;
    /** at人的列表，{"uid":"nick"}对象 */
    atList?: {
        [uid: string]: string;
    };
    /** 富文本协议数据 */
    payload: string;
    /** 富文本摘要数据 */
    desc: string;
    /** 富文本里图片信息，"[{"mediaId":"xxx", "picType":1, "orientation":1}]"，picType 1为原图，原图需带上Exif格式方向信息 */
    images?: string;
    /** 富文本渲染小程序id */
    miniAppId: string;
    /** 富文本渲染小程序小组件名 */
    widgetName: string;
    /** 富文本预估高度信息，"[{"type":"txt", "width":200}, {"type":"img", "width":200, "height":100}]"，文字为一行预估宽度，图片为显示宽高 */
    estimateAreas?: string;
}
/**
 * 发送富文本消息 返回结果定义
 * @apiName internal.chat.sendRichTextMessage
 */
export interface IInternalChatSendRichTextMessageResult {
    [key: string]: any;
}
/**
 * 发送富文本消息
 * @apiName internal.chat.sendRichTextMessage
 * @supportVersion ios: 4.7.5 android: 4.7.5
 */
export declare function sendRichTextMessage$(params: IInternalChatSendRichTextMessageParams): Promise<IInternalChatSendRichTextMessageResult>;
export default sendRichTextMessage$;
