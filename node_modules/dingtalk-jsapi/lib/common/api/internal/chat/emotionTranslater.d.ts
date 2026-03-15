export declare const apiName = "internal.chat.emotionTranslater";
/**
 * 表情翻译器 请求参数定义
 * @apiName internal.chat.emotionTranslater
 */
export interface IInternalChatEmotionTranslaterParams {
    /** 表情的key列表，形如"[鼓掌]"，支持中英文两种。如果列表为空，返回所有表情元素 */
    emotionKeys: string[];
}
/**
 * 表情翻译器 返回结果定义
 * @apiName internal.chat.emotionTranslater
 */
export interface IInternalChatEmotionTranslaterResult {
    data: Array<{
        /** 表情的key，形如：{"en_US" : "[Smile]", "zh_CN": "[微笑]"} */
        emotionKey: string;
        /** 表情的Id，由服务端下发 */
        emotionId: string;
        /** 动态表情的Id，由服务端下发 */
        dynamicEmotionId: string;
        /** 表情的版本，由服务端下发 */
        emotionVersion: string;
    }>;
}
/**
 * 表情翻译器
 * @apiName internal.chat.emotionTranslater
 * @supportVersion ios: 6.0.10 android: 6.0.10 pc: 6.0.10
 * @author iOS: 鱼非 android: 千凡 windows: 仟晨 mac: 仟晨
 */
export declare function emotionTranslater$(params: IInternalChatEmotionTranslaterParams): Promise<IInternalChatEmotionTranslaterResult>;
export default emotionTranslater$;
