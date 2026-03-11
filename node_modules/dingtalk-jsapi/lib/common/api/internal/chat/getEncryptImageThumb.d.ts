export declare const apiName = "internal.chat.getEncryptImageThumb";
/**
 * 三方加密图片解密 请求参数定义
 * @apiName internal.chat.getEncryptImageThumb
 */
export interface IInternalChatGetEncryptImageThumbParams {
    /** 消息所在会话的id */
    cid: string;
    /** 对应的消息id */
    mid: number;
}
/**
 * 三方加密图片解密 返回结果定义
 * @apiName internal.chat.getEncryptImageThumb
 */
export interface IInternalChatGetEncryptImageThumbResult {
    /** 图片缓存的key */
    data: string;
}
/**
 * 三方加密图片解密
 * @apiName internal.chat.getEncryptImageThumb
 * @supportVersion ios: 4.7.5 android: 4.7.5
 */
export declare function getEncryptImageThumb$(params: IInternalChatGetEncryptImageThumbParams): Promise<IInternalChatGetEncryptImageThumbResult>;
export default getEncryptImageThumb$;
