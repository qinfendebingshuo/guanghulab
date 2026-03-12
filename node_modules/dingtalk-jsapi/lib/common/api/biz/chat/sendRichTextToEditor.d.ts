export declare const apiName = "biz.chat.sendRichTextToEditor";
/**
 * 发送富文本到会话富文本编辑器 请求参数定义
 * @apiName biz.chat.sendRichTextToEditor
 */
export interface IBizChatSendRichTextToEditorParams {
    /** 会话id */
    cid?: string;
    /** 加密会话id */
    cidEnc?: string;
    /** 回复的内容 */
    payload?: string;
    /** 想要@的人的uid和昵称 {"uid":"nick"} */
    atOpenIds?: {
        [uid: string]: string;
    };
    /** 想要@的人的dingtalkId和昵称，{"dingtalkId":"nick"} */
    atDingTalkIds?: {
        [dingtalkId: string]: string;
    };
}
/**
 * 发送富文本到会话富文本编辑器 返回结果定义
 * @apiName biz.chat.sendRichTextToEditor
 */
export interface IBizChatSendRichTextToEditorResult {
}
/**
 * 发送富文本到会话富文本编辑器
 * @apiName biz.chat.sendRichTextToEditor
 * @supportVersion ios: 4.7.12 android: 4.7.12
 * @author Android: 风沂; iOS: 鱼非; Windows: 仟晨; Mac: 舒绎
 */
export declare function sendRichTextToEditor$(params: IBizChatSendRichTextToEditorParams): Promise<IBizChatSendRichTextToEditorResult>;
export default sendRichTextToEditor$;
