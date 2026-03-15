export declare const apiName = "biz.contact.complexSelectedPicker";
/**
 * 跳转到已选成员组件 请求参数定义
 * @apiName biz.contact.complexSelectedPicker
 */
export interface IBizContactComplexSelectedPickerParams {
    /** 上游业务来源 */
    origin?: number;
    /** 上游业务来源描述 */
    originMeta?: string;
    [key: string]: any;
}
/**
 * 跳转到已选成员组件 返回结果定义
 * @apiName biz.contact.complexSelectedPicker
 */
export interface IBizContactComplexSelectedPickerResult {
    [key: string]: any;
}
/**
 * 跳转到已选成员组件
 * @apiName biz.contact.complexSelectedPicker
 * @supportVersion  ios: 3.5 android: 3.5
 */
export declare function complexSelectedPicker$(params: IBizContactComplexSelectedPickerParams): Promise<IBizContactComplexSelectedPickerResult>;
export default complexSelectedPicker$;
