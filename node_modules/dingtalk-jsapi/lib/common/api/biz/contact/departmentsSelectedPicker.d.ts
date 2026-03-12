export declare const apiName = "biz.contact.departmentsSelectedPicker";
/**
 * 跳转到已选部门组件 请求参数定义
 * @apiName biz.contact.departmentsSelectedPicker
 */
export interface IBizContactDepartmentsSelectedPickerParams {
    [key: string]: any;
}
/**
 * 跳转到已选部门组件 返回结果定义
 * @apiName biz.contact.departmentsSelectedPicker
 */
export interface IBizContactDepartmentsSelectedPickerResult {
    [key: string]: any;
}
/**
 * 跳转到已选部门组件
 * @apiName biz.contact.departmentsSelectedPicker
 * @supportVersion  ios: 3.5 android: 3.5
 */
export declare function departmentsSelectedPicker$(params: IBizContactDepartmentsSelectedPickerParams): Promise<IBizContactDepartmentsSelectedPickerResult>;
export default departmentsSelectedPicker$;
