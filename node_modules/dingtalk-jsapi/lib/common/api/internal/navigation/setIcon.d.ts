export declare const apiName = "internal.navigation.setIcon";
/**
 * 设置容器标签页前方的icon 请求参数定义
 * @apiName internal.navigation.setIcon
 */
export interface IInternalNavigationSetIconParams {
    /** icon图标的mediaid */
    icon: string;
}
/**
 * 设置容器标签页前方的icon 返回结果定义
 * @apiName internal.navigation.setIcon
 */
export interface IInternalNavigationSetIconResult {
}
/**
 * 设置容器标签页前方的icon
 * @apiName internal.navigation.setIcon
 * @supportVersion pc: 4.7.19
 * @author pc: 法真
 */
export declare function setIcon$(params: IInternalNavigationSetIconParams): Promise<IInternalNavigationSetIconResult>;
export default setIcon$;
