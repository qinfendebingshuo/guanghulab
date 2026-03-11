export declare const apiName = "internal.bizcard.companyPicker";
/**
 * 选择公司列表 请求参数定义
 * @apiName internal.bizcard.companyPicker
 */
export interface IInternalBizcardCompanyPickerParams {
}
/**
 * 选择公司列表 返回结果定义
 * @apiName internal.bizcard.companyPicker
 */
export interface IInternalBizcardCompanyPickerResult {
    orgName: string;
    title: string;
    orgId: number;
    orgAuthed: boolean;
}
/**
 * 选择公司列表
 * @apiName internal.bizcard.companyPicker
 * @supportVersion ios: 4.5.21 android: 4.5.21
 */
export declare function companyPicker$(params: IInternalBizcardCompanyPickerParams): Promise<IInternalBizcardCompanyPickerResult>;
export default companyPicker$;
