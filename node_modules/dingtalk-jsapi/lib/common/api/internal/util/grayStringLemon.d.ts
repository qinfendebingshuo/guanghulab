export declare const apiName = "internal.util.grayStringLemon";
/**
 * 获取新灰度流程下的开关配置值（string） 请求参数定义
 * @apiName internal.util.grayStringLemon
 */
export interface IInternalUtilGrayStringLemonParams {
    module: string;
    key: string;
    orgId?: number;
    default?: string;
}
/**
 * 获取新灰度流程下的开关配置值（string） 返回结果定义
 * @apiName internal.util.grayStringLemon
 */
export declare type IInternalUtilGrayStringLemonResult = string;
/**
 * 获取新灰度流程下的开关配置值（string）
 * @apiName internal.util.grayStringLemon
 * @supportVersion ios: 5.1.11 android: 5.1.11 pc: 5.1.11
 * @author iOS : 冬翔 Android : 卓剑 Windows： 法真 Mac: 法真
 */
export declare function grayStringLemon$(params: IInternalUtilGrayStringLemonParams): Promise<IInternalUtilGrayStringLemonResult>;
export default grayStringLemon$;
