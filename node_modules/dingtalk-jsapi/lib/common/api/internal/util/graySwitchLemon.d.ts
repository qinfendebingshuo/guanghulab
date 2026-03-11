export declare const apiName = "internal.util.graySwitchLemon";
/**
 * 获取新灰度流程下的开关配置值 请求参数定义
 * @apiName internal.util.graySwitchLemon
 */
export interface IInternalUtilGraySwitchLemonParams {
    module: string;
    key: string;
    orgId?: number;
    default?: boolean;
}
/**
 * 获取新灰度流程下的开关配置值 返回结果定义
 * @apiName internal.util.graySwitchLemon
 */
export declare type IInternalUtilGraySwitchLemonResult = boolean;
/**
 * 获取新灰度流程下的开关配置值
 * @apiName internal.util.graySwitchLemon
 * @supportVersion ios: 5.1.11 android: 5.1.11 pc: 5.1.11
 * @author iOS : 冬翔 Android : 卓剑 Windows： 法真 Mac: 法真
 */
export declare function graySwitchLemon$(params: IInternalUtilGraySwitchLemonParams): Promise<IInternalUtilGraySwitchLemonResult>;
export default graySwitchLemon$;
