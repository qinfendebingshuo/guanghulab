export declare const apiName = "biz.contact.useTagPicker";
/**
 * 标签选人 请求参数定义
 * @apiName biz.contact.useTagPicker
 */
export interface IBizContactUseTagPickerParams {
    [key: string]: any;
}
/**
 * 标签选人 返回结果定义
 * @apiName biz.contact.useTagPicker
 */
export interface IBizContactUseTagPickerResult {
    [key: string]: any;
}
/**
 * 标签选人
 * @apiName biz.contact.useTagPicker
 * @supportVersion  pc: 3.3.0
 */
export declare function useTagPicker$(params: IBizContactUseTagPickerParams): Promise<IBizContactUseTagPickerResult>;
export default useTagPicker$;
