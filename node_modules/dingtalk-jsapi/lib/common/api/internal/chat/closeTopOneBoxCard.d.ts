export declare const apiName = "internal.chat.closeTopOneBoxCard";
/**
 * 关闭聊天的OneBox吊顶中的某个吊顶。 请求参数定义
 * @apiName internal.chat.closeTopOneBoxCard
 */
export interface IInternalChatCloseTopOneBoxCardParams {
    /** 会话id */
    cid: string;
    /** 吊顶id */
    bid: string;
}
/**
 * 关闭聊天的OneBox吊顶中的某个吊顶。 返回结果定义
 * @apiName internal.chat.closeTopOneBoxCard
 */
export interface IInternalChatCloseTopOneBoxCardResult {
}
/**
 * 关闭聊天的OneBox吊顶中的某个吊顶。
 * @apiName internal.chat.closeTopOneBoxCard
 * @supportVersion ios: 4.7.30 android: 4.7.30
 * @author iOS:济凡，Android:彦海
 */
export declare function closeTopOneBoxCard$(params: IInternalChatCloseTopOneBoxCardParams): Promise<IInternalChatCloseTopOneBoxCardResult>;
export default closeTopOneBoxCard$;
