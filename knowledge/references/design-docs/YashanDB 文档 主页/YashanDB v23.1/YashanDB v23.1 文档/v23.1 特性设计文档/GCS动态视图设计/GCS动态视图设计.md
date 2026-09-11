Created by 龙忠友, last modified on 六月 25, 2023

#   [YDBRD-13477 : GCS动态视图与系统统计](#ydbrd-13477--gcs动态视图与系统统计)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-12140](https://jira.yasdb.com/browse/YDBRD-12140)    SR链接：    [https://jira.yasdb.com/browse/YDBRD-13477](https://jira.yasdb.com/browse/YDBRD-13477)  

##   [1. Overview（概述）](#1-overview概述)  

##   [2. Features（功能特性）](#2-features功能特性)  

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

####   [V$GRC_PASTCOPY](#vgrc-pastcopy)  

该视图显示共享集群PAST COPY BLOCK（多实例同时持有脏块时，只有最新版本的一个实例具备写权限，其他不具备写权限的历史版本实例所持有的脏块称为PAST COPY BLOCK）信息。

|字段|类型|描述|
|---|---|---|
|TS#|INTEGER|页面space id|
|FILE#|INTEGER|页面file id|
|BLK#|INTEGER|页面id|
|RESOURCE_NAME|VARCHAR(128)|资源名称，block资源 [space][file][id]|
|INSTANCE_ID|TINYINT|持有该PAST COPY BLOCK的节点|
|LSN|BIGINT|PAST COPY BLOCK的LSN（Log Sequence Number）|


####   [V$BUFFER_CONTROL](#vbuffer-control)  

该视图显示数据缓存区页面控制信息。

|字段|类型|说明|
|---|---|---|
|ADDR|RAW(8)|buffer control内存地址|
|PART|INTEGER|buffer control所在buffer part区域|
|ID|INTEGER|buffer control编号|
|IN_OLD|BOOLEAN|buffer control是否为OLD|
|LIST_ID|INTEGER|LRU链编号|
|HASH_NEXT|INTEGER|所在bucket的下一个buffer control|
|CR_NEXT|INTEGER|下一个CR buffer control|
|LRU_NEXT|INTEGER|LRU链上下一个buffer control|
|LRU_PREV|INTEGER|LRU链上前一个buffer control|
|BUCKET_ID|INTEGER|BUCKET ID|
|TS#|INTEGER|buffer加载页面的表空间ID|
|FILE#|INTEGER|buffer加载页面的文件ID|
|BLK#|INTEGER|buffer加载页面的页面ID|
|DIRTY|BOOLEAN|是否是脏页|
|LOAD_STATUS|INTEGER|buffer页面加载状态。0：BP_NEED_LOAD；1：BP_IS_LOADING；2：BP_IS_LOADED；3： BP_LOAD_FAILED；4：BP_IS_RECYCLING|
|RES_STATUS|INTEGER|集群下buffer页面的资源状态。0：BP_RES_FREE；1：BP_RES_CR；2：BP_RES_SHARED；3：BP_RES_EXCLUSIVE|
|REF_COUNT|INTEGER|buffer control当前访问的并发数|
|PAST_COPY|INTEGER|buffer control是否为past copy。0：BP_NO_PASTCOPY；1：BP_IS_PASTCOPY；2：BP_HAS_PASTCOPY|
|REMOTE_CR_STATS|INTEGER|远程请求CR block的次数统计|
|FLAGS|RAW(8)|buffer control标记|
|BLK_ADDR|RAW(8)|block的内存地址|
|CR_SCN|BIGINT|CR页面的SCN|
|CR_XID_EXT|INTEGER|CR页面事务所在extent|
|CR_XID_NODE|INTEGER|CR页面事务所在node|
|CR_XID_XSN|INTEGER|CR页面事务的序列号|
|CR_SSN|INTEGER|CR页面的SSN|
|LAST_LFN|BIGINT|redo刷盘序号|
|DIRTY_PREV|RAW(8)|前一个脏页|
|DIRTY_NEXT|RAW(8)|后一个脏页|
|TRUNC_LFN|BIGINT|redo刷盘序号|
|TRUNC_RST|INTEGER|HA故障次数|
|TRUNC_ASN|INTEGER|归档序列号|
|TRUNC_BID|INTEGER|redo块号|


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.资料设计章节](#7资料设计章节)  

###   [7.1 视图文档](#71-视图文档)  

见详细设计章节。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*