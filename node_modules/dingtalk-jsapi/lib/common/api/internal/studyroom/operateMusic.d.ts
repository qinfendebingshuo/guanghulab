export declare const apiName = "internal.studyroom.operateMusic";
/**
 * 学习室同步音乐状态 请求参数定义
 * @apiName internal.studyroom.operateMusic
 */
export interface IInternalStudyroomOperateMusicParams {
    request: any;
}
/**
 * 学习室同步音乐状态 返回结果定义
 * @apiName internal.studyroom.operateMusic
 */
export interface IInternalStudyroomOperateMusicResult {
}
/**
 * 学习室同步音乐状态
 * @apiName internal.studyroom.operateMusic
 * @supportVersion ios: 5.1.18 android: 5.1.18
 * @author iOS：新鹏 Android：峰砺
 */
export declare function operateMusic$(params: IInternalStudyroomOperateMusicParams): Promise<IInternalStudyroomOperateMusicResult>;
export default operateMusic$;
