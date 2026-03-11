export declare const apiName = "internal.log.searchQueryLog";
/**
 * 搜索Querylog通过魔兔上传 请求参数定义
 * @apiName internal.log.searchQueryLog
 */
export interface IInternalLogSearchQueryLogParams {
    /** 埋点版本号(version) */
    vs: number;
    /** UUID，64位log唯一标识 */
    uuid: string;
    /** 搜索入口(entry) */
    e: number;
    /** Tab编号 */
    tab: number;
    /** 结果来源(source) */
    s: number;
    /** 关键词(keyword) */
    kw: string;
    /** 搜索发起时间戳(query_time) */
    q_t: number;
    /** 过滤条件(filter) */
    f?: string;
    /** 搜索类型(item_type) */
    i_t: number;
    /** Rank标识串(item_rank) */
    i_b?: string;
    /** 单次搜索结果数(item_count) */
    i_c: number;
    /** 单次搜索耗时(item_duration) */
    i_d: number;
}
/**
 * 搜索Querylog通过魔兔上传 返回结果定义
 * @apiName internal.log.searchQueryLog
 */
export interface IInternalLogSearchQueryLogResult {
}
/**
 * 搜索Querylog通过魔兔上传
 * @apiName internal.log.searchQueryLog
 * @supportVersion  ios: 3.5.6 android: 3.5.6
 */
export declare function searchQueryLog$(params: IInternalLogSearchQueryLogParams): Promise<IInternalLogSearchQueryLogResult>;
export default searchQueryLog$;
