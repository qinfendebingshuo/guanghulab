export declare const apiName = "internal.guide.closeGuideBanner";
/**
 * 获取App列表 请求参数定义
 * @apiName internal.guide.closeGuideBanner
 */
export interface IInternalGuideCloseGuideBannerParams {
    [key: string]: any;
}
/**
 * 获取App列表 返回结果定义
 * @apiName internal.guide.closeGuideBanner
 */
export interface IInternalGuideCloseGuideBannerResult {
    [key: string]: any;
}
/**
 * 获取App列表
 * @apiName internal.guide.closeGuideBanner
 * @supportVersion  ios: 4.2.0 android: 4.2.0
 */
export declare function closeGuideBanner$(params: IInternalGuideCloseGuideBannerParams): Promise<IInternalGuideCloseGuideBannerResult>;
export default closeGuideBanner$;
