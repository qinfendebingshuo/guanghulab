export declare const apiName = "internal.util.ratingAndFeedback";
/**
 * 为了提高app在app store中/android市场的评分，需要在某些业务流程中唤起好评弹窗 请求参数定义
 * @apiName internal.util.ratingAndFeedback
 */
export interface IInternalUtilRatingAndFeedbackParams {
    /** 弹窗中的标题（必填） */
    title: string;
    /** 弹窗中的描述（必填） */
    description: string;
    /** 弹窗封面图链接（必填） */
    cover_image_url: string;
    /** 点击反馈按钮后跳转页面链接（必填） */
    feedback_url: string;
    /** 反馈按钮标题（必填） */
    feedback_button_title: string;
    /** 业务来源 */
    source: string;
}
/**
 * 为了提高app在app store中/android市场的评分，需要在某些业务流程中唤起好评弹窗 返回结果定义
 * @apiName internal.util.ratingAndFeedback
 */
export interface IInternalUtilRatingAndFeedbackResult {
}
/**
 * 为了提高app在app store中/android市场的评分，需要在某些业务流程中唤起好评弹窗
 * @apiName internal.util.ratingAndFeedback
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function ratingAndFeedback$(params: IInternalUtilRatingAndFeedbackParams): Promise<IInternalUtilRatingAndFeedbackResult>;
export default ratingAndFeedback$;
