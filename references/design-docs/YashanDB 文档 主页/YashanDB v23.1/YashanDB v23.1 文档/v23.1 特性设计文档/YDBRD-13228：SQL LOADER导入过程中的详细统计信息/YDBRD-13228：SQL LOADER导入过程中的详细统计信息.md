Created by 朱月婷 on 七月 17, 2023

  


#   [YDBRD-13228 : SQL LOADER统计信息 Design](#ydbrd-13228--sql-loader统计信息-design)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-13228](https://jira.yasdb.com/browse/YDBRD-13228)  

##   [1. Overview（概述）](#1-overview概述)  

SQL loader导入过程中的详细统计信息。该功能主要为了避免用户在查询统计信息时需要去查询系统的统计信息视图，异常场景参考价值不大。

对于客户端：将统计信息直接打印输出到控制台；

对于服务端：将统计信息输出到log文件中。

##   [2. Features（功能特性）](#2-features功能特性)  

通过指定statistics参数，输出导入过程中的统计信息。对于客户端可直接输出；对于服务端，若silent参数为true，则指定statistics参数也无效。

语法：options(statistics=true),默认为false

主要信息包括：

- 线程数量（reader、decoder）  （degree_of_parallelism,decoder_thread_times)
- 线程通信（时间、内存） ,视图 v$pq_tqstat
- reader线程（时间、内存）
- 1.文件IO时间
- 2.文件buffer大小(一般为2M-128K)
- decoder线程（时间、内存）  (每个线程及最后统计，largeblock数量）
- 1.fetch（时间、行数量、列数量）
- 2.构造数据（lob单拎出来统计io时间）
- 3.batchinsert
- 4.commit(commit_rows,putRest）
- 存储相关定义
- 1.页面构造（时间、内存）
- 2.存储IO（时间、内存）
- 3.存储等待事件（时间、内存）
- 总时间
- 总内存（largeblock，每个线程）


##   [3. Interfaces（接口）](#3-interfaces接口)  

1.初始化统计信息接口loadStatInit

2.计算并更新统计信息接口loadStatUpdate

3.计算平均值接口 loadStatAvg（不包括空闲线程）

4.展示统计信息接口showStat（客户端使用）

5.记录统计信息接口logStat（服务端使用）

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

客户端导入形式的存储相关操作均在服务端进行，无法拿到相关信息，故客户端无存储相关统计信息

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

```
typedef struct StLoadCommStat {
    CodUint32 max;//考虑极端场景翻转
    CodUint32 min;
    CodUint64 count;
    CodUint64 total;//对于无意义的统计项不输出
} LoadCommStat;

```

通过上述结构体记录一个动作消耗的资源，包括时间空间等。

存储的io取自AnlSqlIOStat

存储等待事件取自AnlSqlTimeStat：

包括_X_LOCK,_BUF_BUSY_WAIT,_FREE_BUF_WAIT,_BUF_WRITE，_RD_COMMIT,RD_SWITCH

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

1.outline lob的io是否要算上，算

2.文件大小是0，不打统计信息，判空

3.除数为0

4.中文英文对照表