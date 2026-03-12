export declare const apiName = "internal.chat.showTopicEmotionBar";
/**
 * 打开群话题点赞弹窗 请求参数定义
 * @apiName internal.chat.showTopicEmotionBar
 */
export interface IInternalChatShowTopicEmotionBarParams {
    /** 话题所在的会话id */
    cid: string;
    /** 话题对应的消息id */
    mid: number;
    /** 弹窗相对屏幕左上角的y轴偏移 */
    yoffset?: number;
}
/**
 * 打开群话题点赞弹窗 返回结果定义
 * @apiName internal.chat.showTopicEmotionBar
 */
export interface IInternalChatShowTopicEmotionBarResult {
}
/**
 * 打开群话题点赞弹窗
 * @apiName internal.chat.showTopicEmotionBar
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function showTopicEmotionBar$(params: IInternalChatShowTopicEmotionBarParams): Promise<IInternalChatShowTopicEmotionBarResult>;
export default showTopicEmotionBar$;
