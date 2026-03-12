export declare const apiName = "biz.util.selectEmoji";
/**
 * 选择表情 请求参数定义
 * @apiName biz.util.selectEmoji
 */
export interface IBizUtilSelectEmojiParams {
    [key: string]: any;
}
/**
 * 选择表情 返回结果定义
 * @apiName biz.util.selectEmoji
 */
export interface IBizUtilSelectEmojiResult {
    [key: string]: any;
}
/**
 * 选择表情
 * @apiName biz.util.selectEmoji
 * @supportVersion  ios: 3.5.2 android: 3.5.2
 */
export declare function selectEmoji$(params: IBizUtilSelectEmojiParams): Promise<IBizUtilSelectEmojiResult>;
export default selectEmoji$;
