Created by 黄家华, last modified on 六月 13, 2024



-   [1. 概述](#id-分布式行表支持DML和DQL测试设计-1.概述)  
-   [2. 需求分析](#id-分布式行表支持DML和DQL测试设计-2.需求分析)  
-   [3. 测试设计方法 ](#id-分布式行表支持DML和DQL测试设计-3.测试设计方法)  
    -   [测试目标：](#id-分布式行表支持DML和DQL测试设计-测试目标：)  
    -   [测试方法：](#id-分布式行表支持DML和DQL测试设计-测试方法：)  
        -   [1) 复制并修改分布式数据库现有用例](#id-分布式行表支持DML和DQL测试设计-1)复制并修改分布式数据库现有用例)  
        -   [2) 根据开发提供的分布式行表SQL能力，将没有覆盖到的SQL从单机用例库中获取，修改并添加到分布式用例库](#id-分布式行表支持DML和DQL测试设计-2)根据开发提供的分布式行表SQL能力，将没有覆盖到的SQL从单机用例库中获取，修改并添加到分布式用例库)  
        -   [3) 增加行存表和列存表join，子查询的测试用例](#id-分布式行表支持DML和DQL测试设计-3)增加行存表和列存表join，子查询的测试用例)  
        -   [4) 开发在分布式数据库上运行改造后的测试用例得到新增代码覆盖率，根据开发指导，对没有覆盖的分支添加新用例。](#id-分布式行表支持DML和DQL测试设计-4)开发在分布式数据库上运行改造后的测试用例得到新增代码覆盖率，根据开发指导，对没有覆盖的分支添加新用例。)  
        -   [5) 分布式列表上车工程、单机行表全量用例(不做改造)在分布式数据库跑均没有coredump和hang](#id-分布式行表支持DML和DQL测试设计-5)分布式列表上车工程、单机行表全量用例(不做改造)在分布式数据库跑均没有coredump和hang)  
-   [4. 详细设计](#id-分布式行表支持DML和DQL测试设计-4.详细设计)  
-   [5. 测试用例](#id-分布式行表支持DML和DQL测试设计-5.测试用例)  
-   [6. 测试框架设计](#id-分布式行表支持DML和DQL测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#id-分布式行表支持DML和DQL测试设计-7.测试环境说明)  
-   [8. 补充](#id-分布式行表支持DML和DQL测试设计-8.补充)  




# 1. 概述

SR:     [#YDBRD-18281 分布式行表DML（DQL）支持](https://pingcode.yasdb.com/pjm/items/66114c19579a3edb84d653b6)  

详细设计文档：    [分布式行表详细设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=153014456)  

开发评审：    [分布式行设计评审会议](https://conf.yasdb.com/pages/viewpage.action?pageId=153026496)  

取包地址：    [https://jenkins.yasdb.com/packages/YashanDB/agile/dev_support_dstb_heap/latest/](https://jenkins.yasdb.com/packages/YashanDB/agile/dev_support_dstb_heap/latest/)  

分布式行表SQL能力：    [分布式SQL能力全景图](https://conf.yasdb.com/pages/viewpage.action?pageId=153001333)  

分布式行表开发任务列表：    [分布式行表任务列表](https://conf.yasdb.com/pages/viewpage.action?pageId=150623723)  

测试设计方案    [ https://conf.yasdb.com/pages/viewpage.action?pageId=153022638 ](https://conf.yasdb.com/pages/viewpage.action?pageId=153022638)  

用例MR链接    [ https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/34421#02952eac1e0f9eba8e14d8f290540021b1e71757 ](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/34421#02952eac1e0f9eba8e14d8f290540021b1e71757)  

分布式行表内置函数：    [内置函数支持情况-2024-05-30](https://conf.yasdb.com/pages/viewpage.action?pageId=153024911)  

# 2. 需求分析

需求来源：  内部需求    
  提出人：何金阳    
  场 景：    
  1、分布式数据库创建并使用行表    
  需求描述：    
  分布式行表DML（DQL）支持

# 3. 测试设计方法 

## 测试目标：

1) 分布式行表内置函数 和 分布式行表SQL能力全景图 上所列项目至少有一条用例覆盖

2) 分布式行表新增代码覆盖率不低于原有代码平均覆盖率。

3) 分布式原有上车工程、改造后用例、原单机用例不改造在分布式数据库上跑均没有hang和coredump

4) 分布式行表跑通TPCC、TPCH

## 测试方法：

### 1) 复制并修改分布式数据库现有用例

#### a. 测试用例目录 (将tac表创建语法转成heap表创建语法，包含duplicate和shared，有些在tac测试用例中没有的，使用lsc表用例转换)：

- DML1~6 - DML和DQL的用例
- explain - 执行计划相关用例
- function1~6 - 函数相关用例
- plsql - PLSQL相关用例
- datatype：需确认下是在ddl的SR中测试还是在dml的SR中测? - LOB等各种数据类型的覆盖
- multicn下的dml目录 - PX


保证以下表格中每一子项都有用例覆盖，没有找到用例的标红并在单机用例中寻找。

#### b. 分布式现有列存用例梳理：

##### i.     [DML功能分析](https://conf.yasdb.com/pages/viewpage.action?pageId=153014456#132-dml%E5%8A%9F%E8%83%BD%E5%88%86%E6%9E%90)  

|属性|场景名称|分布式tac表测试用例|补充说明（单机行表测试用例或者新增用例）|
|:---|:---|:---|:---|
|Hint|指定JOIN方式，USE/NO_USE HASH/MERGE/NL|distribution\dml1\use_index\tac\index_mul_table\test_sdv_multbs_with_all_index_nestloop_dup_01.sql – use_nl,distribution\testcase\DML1\bloomfilter\full_join\tac\bloom_hash_full_join_03_tac.sql,distribution\testcase\DML1\bloomfilter\inner_join\tac\bloom_hash_inner_join_05_tac.sql,distribution\testcase\DML1\use_index\tac\index_range_scan_col\test_sdv_index_range_scan_col_shard_015.sql,distribution\testcase\DML2\subquery\lsc\test_from_subquery_pull_sit_08.sql,distribution\dml5\orderby_push\tac\test_sdv_ydbrd_5938_hash_inner.sql – use_hash,distribution\dml5\orderby_push\tac\test_sdv_ydbrd_5938_merge_inner.sql - use_merge,distribution\testcase\DML6\insert_into_select\lsc\insert_into_select_hint.sql - no_use_nl,distribution\testcase\DDL_02\outline\tac\test_sdv_outline_071.sql - no_use_nl,distribution\function1\merge_into\merge_left_join_result\tac\test_sdv_merge_left_join_combination_explain.sql - no_use_merge,distribution\plsql\Static_SQL\grammarch\test_sdv_grammarch_jg_001_select.sql - no_use_hash,distribution\DML6\insert_into_select\tac\insert_into_select_hint.sql - no_use_hash|D:\ysdb\yasft-master\standalone\testcase\dml4\hint\*\heap\|
|  
|调整JOIN ORDER，LEADING|D:\test\yasft\distribution\testcase\DML1\bloomfilter\full_join\tac\,D:\test\yasft\distribution\testcase\DML1\bloomfilter\inner_join\tac\,D:\test\yasft\distribution\testcase\DML5\orderby_push\tac\,D:\test\yasft\distribution\testcase\DML5\px_parallel\tac\,D:\test\yasft\distribution\testcase\DML6\insert_into_select\tac\,D:\test\yasft\distribution\testcase\function2\test_sdv_dml_agg\tac\,D:\test\yasft\distribution\testcase\unsupport\tac\test_cbodelete_unsupport.sql|  
|
|  
|指定TABLE SCAN，FULL|D:\test\yasft\distribution\testcase\DML2\subquery_delete\tac\,D:\test\yasft\distribution\testcase\DML6\index\tac\,D:\test\yasft\distribution\testcase\DML6\insert_into_select\tac\,D:\test\yasft\distribution\testcase\explain\test_sdv_subquery_delete\tac\|  
|
|  
|指定INDEX SCAN，INDEX/INDEX_FFS/NO_INDEX|D:\test\yasft\distribution\testcase\DML1\use_index\tac\,D:\test\yasft\distribution\testcase\DML5\orderby\tac\,D:\test\yasft\distribution\testcase\DML6\index\tac\,D:\test\yasft\distribution\testcase\DML6\insert_into_select\tac\,D:\test\yasft\distribution\testcase\explain\test_sdv_index_02\tac\index_mul_table\|D:\ysdb\yasft-master\standalone\testcase\dml4\hint\hint_index\|
|  
|指定谓词选择率SELECTIVITY|D:\test\yasft\distribution\testcase\DML2\selectivity\tac\,D:\test\yasft\distribution\testcase\explain\test_sdv_hint_selectivity\tac|D:\ysdb\yasft-master\standalone\testcase\dml4\hint\hint_selectivity|
|INSERT|支持单行、多行插入|D:\ysdb\yasft-master\distribution\testcase\DML1\base\test_sdv_insert\tac,D:\ysdb\yasft-master\distribution\testcase\DML1\base\partial_column_insert\tac,D:\test\yasft\distribution\testcase\DML4\insert_bulkload\,D:\test\yasft\distribution\testcase\DML6\insert_into_select\tac\,D:\ysdb\yasft-master\distribution\testcase\DML6\insert_select\tac,D:\test\yasft\distribution\testcase\DML6\insert_on_duplicate_key\tac\|  
|
|  
|支持指定二级分区插入|D:\ysdb\yasft-master\distribution\testcase\DML6\subpartition_dml\tac,D:\test\yasft\distribution\testcase\DML4\insert_bulkload\tac|  
|
|DELETE|基本语法，包含Filter条件|D:\test\yasft\distribution\testcase\DML1\base\scol_delete\lsc\,D:\test\yasft\distribution\testcase\DML2\update_delete\tac\,D:\test\yasft\distribution\testcase\DML2\subquery_delete\tac\|  
|
|UPDATE|非分布键更新，基本语法，包含Filter条件|D:\test\yasft\distribution\testcase\DML2\update_delete\tac,D:\ysdb\yasft-master\distribution\testcase\DML2\update_subquery\duplicated\tac,D:\ysdb\yasft-master\distribution\testcase\DML2\update_subquery\shared\tac|  
|
|SELECT|分布表，复制表 ， 分布表的分区表|D:\ysdb\yasft-master\distribution\testcase\DML1\base\test_sdv_select\tac,D:\ysdb\yasft-master\distribution\testcase\DML2\simple_queries\lsc|  
|
|  
|order by | limit | 聚合(count, sum, max, min, avg)|D:\test\yasft\distribution\testcase\DML2\topn\tac\,D:\test\yasft\distribution\testcase\DML2\test_top_sort_distinct\top_sort_distinct\tac\,D:\ysdb\yasft-master\distribution\testcase\DML4\sort_parallel\tac,D:\ysdb\yasft-master\distribution\testcase\DML5\orderby\tac,D:\ysdb\yasft-master\distribution\testcase\DML5\orderby_push\tac|  
|
|  
|having | group by | distinct|D:\test\yasft\distribution\testcase\DML1\base\hash_group\tac\,D:\ysdb\yasft-master\distribution\testcase\DML3\having\tac,D:\ysdb\yasft-master\distribution\testcase\DML3\having_optimize\tac,D:\ysdb\yasft-master\distribution\testcase\DML3\distinct\tac,D:\ysdb\yasft-master\distribution\testcase\DML4\groupby|  
|
|  
|并行查询（表扫描）|D:\ysdb\yasft-master\distribution\testcase\DML5\parallel|  
|
|  
|union|union all|D:\ysdb\yasft-master\distribution\testcase\DML2\union\tac|  
|
|  
|窗口函数|D:\test\yasft\distribution\testcase\function3\winfunc_push\tac,D:\test\yasft\distribution\testcase\function3\OLAP_func\test_sdv_OLAP_winfunc_cbo\tac\|  
|
|  
|Top N|D:\test\yasft\distribution\testcase\DML2\topn\tac\|  
|
|  
|MINUS | MINUS ALL|D:\ysdb\yasft-master\distribution\testcase\DML5\setOp\tac|  
|
|  
|INTERSECT | INTERSECT ALL|D:\ysdb\yasft-master\distribution\testcase\DML5\setOp\tac|  
|


#####   [ii. 表达式的支持](https://conf.yasdb.com/pages/viewpage.action?pageId=153014456#133-%E8%A1%A8%E8%BE%BE%E5%BC%8F%E7%9A%84%E6%94%AF%E6%8C%81)  

|属性|分布式tac表测试用例|补充说明|
|:---|:---|:---|
|加减乘除|D:\test\yasft\distribution\testcase\DML1\base\simple_expression_calculation\tac\|  
|
|取余，取反|D:\test\yasft\distribution\testcase\function2\test_sdv_dml_MOD\tac\,D:\test\yasft\distribution\testcase\DML1\boolexpr\duplicated_tb\tac\,D:\test\yasft\distribution\testcase\DML1\boolexpr\shared_tb\tac\|  
|
|位与，或，异或|D:\test\yasft\distribution\testcase\function1\test_sdv_bitfunc\tac\|  
|
|Boolean运算|D:\test\yasft\distribution\testcase\DML1\boolexpr\duplicated_tb\tac\,D:\test\yasft\distribution\testcase\DML1\boolexpr\shared_tb\tac\|  
|
|ALL | ANY |SOME|D:\test\yasft\distribution\testcase\DML2\subquery\tac\test_sdv_any_all_testcase\|  
|
|AND | OR | IS NULL | IS NOT NULL|D:\test\yasft\distribution\testcase\DML1\boolexpr\duplicated_tb\tac\,D:\test\yasft\distribution\testcase\DML1\test_sdv_null_func\tac\|  
|
|[NOT] EXISTS | [NOT] IN|D:\test\yasft\distribution\testcase\DML1\boolexpr\duplicated_tb\tac\,D:\test\yasft\distribution\testcase\DML1\boolexpr\shared_tb\tac\,D:\test\yasft\distribution\testcase\DML2\subquery\tac\test_sdv_dml_exists_nestloopjoin_tac\|  
|
|[NOT] LIKE|D:\test\yasft\distribution\testcase\DML3\filter\LIKE_DU_LSC_filter\tac\|  
|
|[NOT] REG LIKE|D:\test\yasft\distribution\testcase\function1\regexp_like\tac\,D:\test\yasft\distribution\testcase\function1\rlike\tac\|  
|
|>= | > | < | <= | <>|D:\test\yasft\distribution\testcase\DML1\base\simple_expression_calculation\tac\|  
|


#####   [iii. 数据类型的支持](https://conf.yasdb.com/pages/viewpage.action?pageId=153014456#134-%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B%E7%9A%84%E6%94%AF%E6%8C%81)  

|属性|分布式tac表测试用例|补充说明|
|:---|:---|:---|
|TINYINT | SMALLINT | INT | BIGINT|D:\ysdb\yasft-master\distribution\testcase\datatype_01\decimal\tac|  
|
|NUMBER|D:\ysdb\yasft-master\distribution\testcase\datatype_01\number\tac\|  
|
|FLOAT | DOUBLE|D:\ysdb\yasft-master\distribution\testcase\datatype_01\double\tac\,D:\ysdb\yasft-master\distribution\testcase\datatype_01\float126\tac\|  
|
|Boolean运算|D:\test\yasft\distribution\testcase\DML1\boolexpr\duplicated_tb\tac\,D:\test\yasft\distribution\testcase\DML1\boolexpr\shared_tb\tac\|  
|
|CHAR | VARCHAR | VARCHAR2|D:\ysdb\yasft-master\distribution\testcase\datatype_01\char\tac\,D:\ysdb\yasft-master\distribution\testcase\datatype_01\varchar32k\tac\|  
|
|N char字符型|D:\ysdb\yasft-master\distribution\testcase\datatype_01\other\lsc\test_sdv_dml_datatype_other_varchar_SH|DU_LSC.sql|  
|
|NCHAR | NVARCHAR|D:\ysdb\yasft-master\distribution\testcase\DML6\fetch\lsc\test_sdv_dml_fetch_08.sql|  
|
|字符集|D:\ysdb\yasft-master\distribution\testcase\DML2\subquery_delete\tac\test_sdv_YDBRD_13630_SIT_03_DU_TAC.sql,D:\ysdb\yasft-master\distribution\testcase\function1\json_array_get\tac\test_sdv_json_array_get_03_tac.sql,D:\ysdb\yasft-master\distribution\testcase\function1\regexp_like\tac\test_sdv_regexp_like_tac_gbk|iso|ascii.sql|  
|
|DATE | TIMESTAMP | TIMESTAMP(n)|D:\ysdb\yasft-master\distribution\testcase\datatype_01\timestamp\tac,D:\ysdb\yasft-master\distribution\testcase\datatype_01\Date\tac|  
|
|DS_INTERVAL | YM_INTERVAL|D:\ysdb\yasft-master\distribution\testcase\datatype_01\interval\tac|  
|
|TIME|D:\ysdb\yasft-master\distribution\testcase\datatype_01\time\tac|  
|
|RAW(n)|D:\ysdb\yasft-master\distribution\testcase\datatype_01\raw\tac|  
|
|BOOLEAN|D:\ysdb\yasft-master\distribution\testcase\datatype_01\boll\tac\|  
|


####   [iv 函数](https://conf.yasdb.com/pages/viewpage.action?pageId=153014456#135-%E5%87%BD%E6%95%B0)  

|属性|分布式tac表测试用例|补充说明|
|:---|:---|:---|
|数学运算函数|D:\ysdb\yasft-master\distribution\testcase\datatype_01\decimal\tac,D:\ysdb\yasft-master\distribution\testcase\function4\test_sdv_math\tac\,D:\ysdb\yasft-master\distribution\testcase\function5\test_sdv_YDBRD7241\tac\|ABS，ACOS，ASIN，ATAN，ATAN2，COS，COT， CEIL，DIV，EXP，FLOOR，LOG，LN，MOD，PI，POW，POWER，ROUND，SIGN，SIN，SINH，SQRT，TAN，TANH，TRUNC...|
|数学运算函数|D:\ysdb\yasft-master\distribution\testcase\datatype_01\char\tac\,D:\ysdb\yasft-master\distribution\testcase\datatype_01\decimal\tac\|STDDEV，STDDEV_POP，STDDEV_SAMP，VAR_POP，VAR_SAMP，VARIANCE|
|字符处理函数|D:\ysdb\yasft-master\distribution\testcase\datatype_01\char\tac\,D:\ysdb\yasft-master\distribution\testcase\datatype_01\varchar32k\tac\,D:\ysdb\yasft-master\distribution\testcase\DML6\nlssort\tac,D:\ysdb\yasft-master\distribution\testcase\function3\test_sdv_function_substring_index\tac\,D:\ysdb\yasft-master\distribution\testcase\function3\test_sdv_func_substring\tac|ASCII，CHR，CONCAT，INITCAP，INSTR，LEFT，LENGTH，LOWER，LPAD，LTRIM，NLSSORT，POSITION，REPLACE，RIGHT，RPAD，RTRIM，SPLIT，STRPOS，SUBSTR，TRIM，UPPER|
|正则匹配函数|D:\ysdb\yasft-master\distribution\testcase\datatype_01\decimal\tac\test_decimal_testcases_func_02_tac.sql,D:\ysdb\yasft-master\distribution\testcase\datatype_01\scienceCountM\tac\test_sdv_scienceCountM_tac_07.sql,D:\ysdb\yasft-master\distribution\testcase\DML3\UNSUPPORT_ERROR\tac\test_sdv_16483_UNSUPPORT_ERROR_tac_02.sql,D:\ysdb\yasft-master\distribution\testcase\function1\regexp_fun\tac|REGEXP_LIKE，REGEXP_COUNT，REGEXP_INSTR，REGEXP_REPLACE，REGEXP_SUBSTR， ......|
|转换函数|D:\ysdb\yasft-master\distribution\testcase\DML2\test_numto\tac\,D:\ysdb\yasft-master\distribution\testcase\DML3\UNSUPPORT_ERROR\tac\test_sdv_16483_UNSUPPORT_ERROR_tac_02.sql,D:\ysdb\yasft-master\distribution\testcase\DML1\test_sdv_null_func\tac\test_sdv_null_tac_normalTable01_01.sql|BIN_TO_NUM，CAST，NUMTODSINTERVAL，NUMTOYMINTERVAL，TO_CHAR，TO_DATE，TO_DSINTERVAL，TO_NUMBER，TO_TIMESTAMP，TO_YMINTERVAL，.....|
|集合处理函数|D:\ysdb\yasft-master\distribution\testcase\function2\test_sdv_dml_character\tac\,D:\ysdb\yasft-master\distribution\testcase\function3\test_decode_para_number\tac\|COALESCE，DECODE，GREATEST，LEAST，NVL，NVL2，LNNVL......|
|聚集函数|D:\ysdb\yasft-master\distribution\testcase\function2\test_sdv_dml_agg\tac|AVG，COUNT，MAX，MIN，SUM，GROUP_CONCAT，LISTAGG，WM_CONCAT......|
|窗口函数|D:\ysdb\yasft-master\distribution\testcase\explain\winfunc_push\tac\,D:\test\yasft\distribution\testcase\function3\OLAP_func\test_sdv_OLAP_winfunc_cbo\tac\|AVG，COUNT，FIRST，FIRST_VALUE，LAST，LAST_VALUE，LEAD，MAX，SUM，RANK，ROW_NUMBER，FRAME......|
|系统函数|D:\ysdb\yasft-master\distribution\testcase\DML2\test_scn_timestamp\tac\|SCN_TO_TIMESTAMP，TIMESTAMP_TO_SCN，USERENV，SYS_CONTEXT, STDDEV，STDDEV_POP，STDDEV_SAMP，VAR_POP，VAR_SAMP，VARIANCE|
|时间处理函数|D:\ysdb\yasft-master\distribution\testcase\function1\test_sdv_add_months\tac\,D:\ysdb\yasft-master\distribution\testcase\function2\test_sdv_dml_date\tac\|ADD_MONTHS，CURRENT_TIMESTAMP，EXTRACT，LAST_DAY，NOW，NEXT_DAY，......|
|条件处理函数|D:\ysdb\yasft-master\distribution\testcase\DML1\test_sdv_null_func\tac\|IF，IFNULL，ISNULL，NULLIF， ......|
|其他函数|D:\ysdb\yasft-master\distribution\testcase\datatype_01\varchar32k\tac\test_sdv_SR15900_076.sql,D:\ysdb\yasft-master\distribution\testcase\DDL_03\index\function_index\tac\test_sdv_function_index_sit_tac_004.sql,D:\ysdb\yasft-master\distribution\testcase\DML1\cte\test_ydbrd_23640_CTE\test_ydbrd_23640_case_002.sql,大部分random的用例都因为不支持或者不稳定而注释掉了,D:\ysdb\yasft-master\distribution\testcase\multicn\dml\px_function\tac\test_px_channel.sql,D:\ysdb\yasft-master\distribution\testcase\multicn\dml\px_function\tac\test_px_obj.sql,D:\ysdb\yasft-master\distribution\testcase\function4\test_sdv_translate\,D:\ysdb\yasft-master\distribution\testcase\datatype_01\char\tac\test_datatype_char_varchar_13.sql,D:\ysdb\yasft-master\distribution\testcase\datatype_01\char\tac\test_datatype_char_varchar_dup_13.sql,D:\ysdb\yasft-master\standalone\testcase\function3\OLAP_func\heap\test_sdv_OLAP_dense_rank\|RANDOM, PX_CHANNEL, PX_OBJECT, TRANSLATE，DENSE_RANK|


####   [v. DML功能约束](https://conf.yasdb.com/pages/viewpage.action?pageId=153014456#22-dml%E5%8A%9F%E8%83%BD%E7%BA%A6%E6%9D%9F)  

|功能|分布式tac表测试用例|补充说明|
|:---|---|:---|
|Merge into|dml2\subquery\lsc\test_from_subquery_pull_sit_04.sql,plsql01\test_sdv_cte\test_sdv_plsql_cte_dst_085.sql – ,在forall中使用cte-merge into|不支持|
|Hint 指定 PARALLEL能力|D:\test\yasft\distribution\testcase\DML1\conditions_pushdown\tac\test_YDBRD6346_tac_push_down_2stage_fetch.sql,D:\test\yasft\distribution\testcase\DML1\use_index\tac\index_mul_table\test_sdv_multbs_with_all_index_dup_04.sql,D:\test\yasft\distribution\testcase\DML1\use_index\tac\index_mul_table\test_sdv_multbs_with_all_index_shard_dup_mix_02.sql,D:\test\yasft\distribution\testcase\DML1\use_index\tac\index_range_scan_col\test_sdv_index_range_scan_col_parallel.sql,D:\test\yasft\distribution\testcase\explain\test_sdv_index_02\tac\index_mul_table\test_sdv_multbs_with_all_index_dup_04.sql|不支持|
|INSERT POINT PARTITION|D:\test\yasft\distribution\testcase\DML4\insert_bulkload\ydbrd21586_insert_into_scol_01.sql|分区表不支持指定分区插入|
|INSERT ALL|D:\test\yasft\distribution\testcase\DML6\insert_into_select\tac\,D:\test\yasft\distribution\testcase\plsql\Static_SQL\grammarch\test_sdv_grammarch_jg_024_insert_multi_table.sql,D:\test\yasft\distribution\testcase\DML6\insert_select\tac\|多表插入|
|INSERT INTO VALUES(subquery)|D:\test\yasft\distribution\testcase\DML6\insert_on_duplicate_key\tac\test_sdv_insert_on_duplicate_001_003.sql,D:\test\yasft\distribution\testcase\function4\test_sdv_nullif\tac\test_sdv_nullif_07_tac.sql|不支持插入列带查询结果|
|ON DUPLICATE KEY UPDATE|D:\test\yasft\distribution\testcase\DML6\insert_on_duplicate_key\tac\|不支持|
|INSERT INTO SELECT|D:\test\yasft\distribution\testcase\DML6\insert_into_select\tac\|支持|
|INSERT INTO ... RETURNING|D:\test\yasft\distribution\testcase\unsupport\tac\test_sit_plsql_ins_return_7256_1.sql|不支持|
|DELETE FILTER(SubQuery)|D:\test\yasft\distribution\testcase\DML1\base\scol_delete\lsc\test_sdv_delete_scol_where_subquery_lsc.sql,D:\test\yasft\distribution\testcase\DML2\update_delete\tac\test_sdv_delete_qr_tac1.sql|不支持Delete 跟子查询语法|
|DELETE 多表|D:\test\yasft\distribution\testcase\DML2\subquery_delete\tac\test_sdv_YDBRD_13630_02_SH_TAC.sql,D:\test\yasft\distribution\testcase\DML2\subquery_delete\tac\test_sdv_YDBRD_13630_06_DU_TAC.sql|不支持Delete 多表以及带多表关联查询|
|update 分布建|D:\test\yasft\distribution\testcase\DML5\partition\tac\test_sdv_row_movement_YDBRD_14078_tac_01.sql|不支持|
|update 多表|D:\test\yasft\distribution\testcase\DML2\update_subquery\duplicated\tac\test_sdv_YDBRD_13629_UPDATE_SUBQUERY_DUPLICATED_26.sql,D:\test\yasft\distribution\testcase\DML2\update_subquery\shared\tac\test_sdv_YDBRD_13629_UPDATE_SUBQUERY_26.sql|不支持Update多表关联查询|
|update filter（subquery）|D:\test\yasft\distribution\testcase\DML2\update_subquery\shared\tac\,D:\test\yasft\distribution\testcase\DML2\update_subquery\duplicated\tac\,D:\test\yasft\distribution\testcase\DML1\test_sdv_NULL_UNKNOWN\tac\test_sdv_null_unknown_014.sql,D:\test\yasft\distribution\testcase\DML1\test_sdv_NULL_UNKNOWN\tac\test_sdv_null_unknown_015.sql|不支持update filter条件带子查询|
|分布式聚合操作|D:\test\yasft\distribution\testcase\DML2\topn\tac\test_sdv_topn_ydbrd_23934_dpul_tac_parallel.sql,D:\test\yasft\distribution\testcase\DML6\hash_grouping\tac\test_YDBRD_21510_hashGrouping_15.sql|grouping, grouping_id, group id, grouping sets，cube，rollup|
|AC扫描|D:\test\yasft\distribution\testcase\DML1\cost\tac\test_sdv_cost_ac_scan.sql,D:\test\yasft\distribution\testcase\DML1\bloomfilter\tac\full_join\bloom_hash_full_join_01_AC_tac.sql ...,D:\test\yasft\distribution\testcase\DML2\subquery\tac\test_sdv_dml_sub_from_testcase\test_sdv_dml_SUB_FROM_DU_TAC_AC.sql,D:\test\yasft\distribution\testcase\DML2\subquery\tac\test_sdv_dml_sub_from_testcase\test_sdv_dml_SUB_FROM_SH_TAC_AC.sql|grouping, grouping_id, group id, grouping sets，cube，rollup|
|系统表和系统视图，分布式系统视图的基础查询|D:\test\yasft\distribution\testcase\system_view\sys_views\tac\test_sdv_dml_sysviews1.sql,D:\test\yasft\distribution\testcase\system_view\sys_views\tac\test_sdv_dml_sys_view.sql|不支持|
|并行查询|D:\test\yasft\distribution\testcase\DML5\parallel\test_ydbrd5299_subquery\tac\,D:\test\yasft\distribution\testcase\DML5\px_parallel\tac\|不支持并行查询（hash join，hash group）| 并行增强（sort）| 并行增强（窗口函数，connect by，集合操作， group concat， merge join，NL join）| Order by子查询|
|递归CTE|D:\test\yasft\distribution\testcase\plsql01\test_sdv_cte\|不支持|
|递归 [union | union all]|D:\test\yasft\distribution\testcase\dml2\union\tac\|不支持|
|计算分布键支持多列|D:\test\yasft\distribution\testcase\explain\test_sdv_pxSender_pxReceiver\tac\,D:\test\yasft\distribution\testcase\DML5\px_sender_parallel\tac\|不支持|
|两阶段窗口函数|D:\test\yasft\distribution\testcase\explain\distinct_cn\test_sdv_YDBRD_21536_explain.sql,D:\test\yasft\distribution\testcase\DML3\distinct\distinct_cn\test_sdv_YDBRD_21536_001.sql|不支持|
|FOR UPDATE|D:\test\yasft\distribution\testcase\DML1\use_index\tac\index_unique_scan_col\test_sdv_index_unique_scan_col_dup_001~009.sql,D:\test\yasft\distribution\testcase\DML1\use_index\tac\index_unique_scan_col\test_sdv_index_unique_scan_col_shard_001~009.sql,D:\test\yasft\distribution\testcase\DML5\access_constraint\ac_select\test_sdv_ac_select_015.sql|不支持|
|系统表或系统视图，分布式系统视图join|D:\test\yasft\distribution\testcase\system_view\sys_views\tac\test_sdv_dml_sysviews1.sql – 需要把注释删掉,D:\test\yasft\distribution\testcase\system_view\dv_segments\tac\test_sdv_YDBRD_23701_010.sql|不支持|
|系统表或系统视图与普通表join|D:\test\yasft\distribution\testcase\DML6\join\lsc\test_sdv_dml_LRJoin_DU_LSC.sql,D:\test\yasft\distribution\testcase\DML6\join\lsc\test_sdv_dml_LRJoin_SH_LSC.sql,D:\test\yasft\distribution\testcase\DML6\join\lsc\test_sdv_dml_LRJoin_SHDU_LSC.sql|不支持|
|分布式系统视图与普通表join|D:\test\yasft\distribution\testcase\system_view\dv_segments\tac\test_sdv_YDBRD_23701_010.sql|不支持|
|条件下推（布隆过滤器）|D:\test\yasft\distribution\testcase\DML1\bloomfilter\complex\tac\|不支持|
|ROWNUM|D:\test\yasft\distribution\testcase\unsupport\tac\test_sdv_OLAP_row_number_tac_2.sql,D:\test\yasft\distribution\testcase\unsupport\tac\test_sdv_rownum_tac.sql|不支持|
|ROWID|D:\test\yasft\distribution\testcase\DML2\rowid\tac\test_sdv_col_rowid_01、02.sql,D:\ysdb\yasft-master\distribution\testcase\unsupport\tac\test_sdv_rowid.sql|不支持|
|CONNECT BY|D:\test\yasft\distribution\testcase\DML5\outer_join_operator\tac\test_sdv_outer_join_operator_tac_008.sql,D:\test\yasft\distribution\testcase\unsupport\tac\test_sdv_connect_by_tac.sql|不支持|
|物化视图|D:\test\yasft\distribution\testcase\unsupport\tac\unsupport.sql|不支持|
|  
|D:\test\yasft\distribution\testcase\DML4\set_push\minus\test_set_push_minus_001~007.sql,D:\test\yasft\distribution\testcase\DML4\set_push\minus_all\test_set_push_minus_all_001~007.sql,D:\test\yasft\distribution\testcase\DML5\setOp\tac\test_sdv_tac_minus_01~04.sql,D:\test\yasft\distribution\testcase\DML5\setOp\tac\test_sdv_tac_minus_all_01~04.sql|MINUS | MINUS ALL|
|  
|D:\ysdb\yasft-master\distribution\testcase\DML4\set_push\intersect\,D:\ysdb\yasft-master\distribution\testcase\DML4\set_push\intersect_all\|INTERSECT | INTERSECT ALL|


####   [vi. 表达式功能约束](https://conf.yasdb.com/pages/viewpage.action?pageId=153014456#23-%E8%A1%A8%E8%BE%BE%E5%BC%8F%E5%8A%9F%E8%83%BD%E7%BA%A6%E6%9D%9F)  

|功能|分布式tac表测试用例|补充说明|
|:---|---|:---|
|位移运算|单机和分布式都没找到|  
|


####   [vii. 数据类型约束](https://conf.yasdb.com/pages/viewpage.action?pageId=153014456#24-%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B%E7%BA%A6%E6%9D%9F)  

|功能|分布式tac表测试用例|补充说明|
|:---|---|:---|
|TIMESTAMP_TZ, TIMESTAMP_LTZ|分布式和单机都没找到用例，单机的注释掉了|  
|
|BIT(n)|D:\ysdb\yasft-master\distribution\testcase\DDL_01\base\tac\ddl_create_table_available_keywords_tac.sql|  
|
|ROWID|D:\ysdb\yasft-master\distribution\testcase\datatype_01\datatype_rowid\tac,D:\ysdb\yasft-master\distribution\testcase\DML2\rowid\tac|  
|
|UROWID|D:\ysdb\yasft-master\distribution\testcase\datatype_01\datatype_rowid\tac|  
|
|UDT | ADT|注释掉了：D:\ysdb\yasft-master\distribution\testcase\DML6\fetch\lsc\test_sdv_dml_fetch_04.sql,D:\ysdb\yasft-master\distribution\testcase\plsql\array_ndims\lsc\test_sdv_var7922_002.sql,D:\ysdb\yasft-master\distribution\testcase\datatype_01\varchar32k\lsc\test_sdv_SR15900_046.sql|  
|
|RECORD|D:\ysdb\yasft-master\distribution\testcase\plsql\bulkcollect\test_sdv_bulk_sr13354_053.sql,D:\ysdb\yasft-master\distribution\testcase\plsql\anonymousblock\other\lsc\|  
|
|ST_GEOMETRY|D:\ysdb\yasft-master\distribution\testcase\unsupport\tac\unsupport.sql|  
|
|JSON|D:\ysdb\yasft-master\distribution\testcase\datatype_01\json\tac,D:\ysdb\yasft-master\distribution\testcase\function1\json_query\tac\|  
|
|LOB|D:\ysdb\yasft-master\distribution\testcase\datatype_01\blob\tac,D:\ysdb\yasft-master\distribution\testcase\datatype\clob\tac|  
|


### 2) 根据开发提供的分布式行表SQL能力，将没有覆盖到的SQL从单机用例库中获取，修改并添加到分布式用例库

以下函数行表支持，列表不支持或者支持度不一样，从单机用例中获取(来源：    [内置函数支持情况-2024-05-30 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153024911)     删除了行列都支持的函数）

|函数名称|行表是否支持|列表是否支持|备注|分布式用例|单机用例|
|:---|:---|:---|:---|---|---|
|  [GROUP_CONCAT](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/GROUP_CONCAT)  |是|否|  
|没有专门的测试用例，但在其他地方有用到|D:\ysdb\yasft-master\standalone\testcase\function6\test_sdv_group_concat\|
|  [LISTAGG](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/LISTAGG)  |是|是|作为非窗口函数，列存表不支持,within group order_by_clause关键字只支持行表|D:\ysdb\yasft-master\distribution\testcase\function3\OLAP_func\test_sdv_listagg\tac\|  
,D:\ysdb\yasft-master\standalone\testcase\function5\test_sdv_listagg_ydbrd7228\|
|  [BIT_LENGTH](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/BIT_LENGTH)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function1\test_sdv_func_bit_length\heap\|
|  [CHAR_LENGTH/CHARACTER_LENGTH](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CHAR_LENGTH%20CHARACTER_LENGTH)  |是|是|对于列存表中的LOB、XMLTYPE类型字段，若某行数据为行外存储，则无法使用本函数进行长度统计|  
|D:\ysdb\yasft-master\standalone\testcase\function4\test_sdv_char_length\|
|  [INSTRB](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/INSTRB)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function4\test_sdv_instrb\heap\|
|  [LENGTH/LENGTHB](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/LENGTH%20LENGTHB)  |是|是|对于列存表中的LOB类型字段，若某行数据为行外存储，则无法使用本函数|D:\ysdb\yasft-master\distribution\testcase\function2\test_sdv_dml_lengthb\tac\|D:\ysdb\yasft-master\standalone\testcase\function6\func_char1\heap\test_sdv_quality_func_lengthb*.sql|
|  [LENGTH2](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/LENGTH2)  |是|否|  
|D:\ysdb\yasft-master\distribution\testcase\function5\length2\tac\|D:\ysdb\yasft-master\standalone\testcase\function5\length2\heap\|
|  [LTRIM](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/LTRIM)  |是|是|对于列存表中的LOB类型字段，若某行数据为行外存储，则无法使用本函数。|没有专门的测试用例，但在其他地方有用到|D:\ysdb\yasft-master\standalone\testcase\function1\test_sdv_ltrim_rtrim\heap\|
|  [OCTET_LENGTH](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/OCTET_LENGTH)  |是|是|对于列存表中的LOB类型字段，若某行数据为行外存储，则无法使用本函数。|没有专门的测试用例，但在其他地方有用到|D:\ysdb\yasft-master\standalone\testcase\function4\test_sdv_char_length\octet_length_*.sql|
|  [RTRIM](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/RTRIM)  |是|是|对于列存表中的LOB类型字段，若某行数据为行外存储，则无法使用本函数。|没有专门的测试用例，但在其他地方有用到|D:\ysdb\yasft-master\standalone\testcase\function1\test_sdv_ltrim_rtrim\heap\|
|  [SUBSTRB](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/SUBSTRB)  |是|否|  
|D:\ysdb\yasft-master\distribution\testcase\datatype\clob\tac\test_sdv_LOB_QR_TAC_004.sql,D:\ysdb\yasft-master\distribution\testcase\unsupport\tac\test_sdv_tac_substrb.sql|D:\ysdb\yasft-master\standalone\testcase\function4\test_sdv_substrb\heap\|
|  [TO_BASE64](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/TO_BASE64)  |是|否|  
|注释掉了：D:\ysdb\yasft-master\distribution\testcase\DML1\cte\test_ydbrd_23640_CTE\test_ydbrd_23640_case_002.sql|D:\ysdb\yasft-master\standalone\testcase\function6\func_char3\heap\test_sdv_quality_func_to_base64*.sql|
|  [TRANSLATE](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/TRANSLATE)  |是|否|  
|D:\test\yasft\distribution\testcase\function4\test_sdv_translate|D:\ysdb\yasft-master\standalone\testcase\function6\func_char3\heap\test_sdv_quality_func_translate*.sql|
|  [TRIM](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/TRIM)  |是|是|对于列存表中的LOB类型字段，若某行数据为行外存储，则无法使用本函数。|  
|D:\ysdb\yasft-master\standalone\testcase\function1\test_sdv_ltrim_rtrim\heap\|
|  [UNISTR](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/UNISTR)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function4\test_sdv_unistr\|
|  [BIN_TO_NUM](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/BIN_TO_NUM)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function5\test_sdv_bin_to_num\|
|  [HEXTORAW](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/HEXTORAW)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function5\hextoraw\|
|  [ROWIDTOCHAR](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/ROWIDTOCHAR)  |是|否|  
|  
|dev分支没有这个用例：D:\ysdb\yasft-master\standalone\testcase\function2\test_sdv_ydbrd29579_rowidtochar\heap\|
|  [DENSE_RANK](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/DENSE_RANK)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function3\OLAP_func\heap\test_sdv_OLAP_dense_rank\|
|  [LAST_VALUE](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/LAST_VALUE)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function3\OLAP_func\heap\test_sdv_OLAP_last_value\last_value_1_60\,D:\ysdb\yasft-master\standalone\testcase\function3\OLAP_func\heap\test_sdv_OLAP_last_value\last_value_other,D:\ysdb\yasft-master\standalone\testcase\function3\OLAP_func\heap\test_sdv_OLAP_last_value\sit_other|
|  [MEDIAN](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/MEDIAN)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function3\OLAP_func\heap\test_sdv_OLAP_median,D:\ysdb\yasft-master\standalone\testcase\function2\median\|
|  [ARRAY_APPEND](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/ARRAY_APPEND)  |是|否|  
|D:\test\yasft\distribution\testcase\plsql\array_append|~~D:\ysdb\yasft-master\standalone\testcase\plsql\Static_SQL\udttype\test_sdv_udttype_jg_027_notoid_array_arrfun.sql~~,~~D:\ysdb\yasft-master\standalone\testcase\plsql\Static_SQL\udttype\test_sdv_udttype_jg_031_fun_to_fun.sql~~,~~D:\ysdb\yasft-master\standalone\testcase\plsql_UDT\array_func_all\array_append\~~|
|  [ARRAY_LENGTH](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/ARRAY_LENGTH)  |是|否|  
|D:\test\yasft\distribution\testcase\plsql\array_length|~~D:\ysdb\yasft-master\standalone\testcase\plsql_UDT\array_func_all\array_length~~|
|  [ARRAY_NDIMS](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/ARRAY_NDIMS)  |是|否|  
|D:\test\yasft\distribution\testcase\plsql\array_ndims|~~D:\ysdb\yasft-master\standalone\testcase\plsql_UDT\array_func_all\array_ndims~~|
|  [ARRAY_POSITION](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/ARRAY_POSITION)  |是|否|  
|D:\test\yasft\distribution\testcase\plsql\array_position|~~D:\ysdb\yasft-master\standalone\testcase\plsql_UDT\array_func_all\array_position~~|
|  [ARRAY_REMOVE](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/ARRAY_REMOVE)  |是|否|  
|D:\test\yasft\distribution\testcase\plsql\array_remove|~~D:\ysdb\yasft-master\standalone\testcase\plsql_UDT\array_func_all\array_remove~~|
|  [ARRAY_REPLACE](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/ARRAY_REPLACE)  |是|否|  
|D:\test\yasft\distribution\testcase\plsql\array_replace|~~D:\ysdb\yasft-master\standalone\testcase\plsql_UDT\array_func_all\array_replace~~|
|  [ARRAY_TO_STRING](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/ARRAY_TO_STRING)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\plsql_UDT\array_func_all\array_to_string|
|  [ARRAY_UPPER](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/ARRAY_UPPER)  |是|否|  
|D:\test\yasft\distribution\testcase\plsql\array_upper|~~D:\ysdb\yasft-master\standalone\testcase\plsql_UDT\array_func_all\array_upper~~|
|  [STRING_TO_ARRAY](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/STRING_TO_ARRAY)  |是|否|  
|D:\test\yasft\distribution\testcase\plsql\string_to_array|~~D:\ysdb\yasft-master\standalone\testcase\plsql_UDT\array_func_all\string_to_array~~|
|  [CHECK_SYS_PRIVILEGE](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CHECK_SYS_PRIVILEGE)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function5\test_check_sys_privilege\heap\|
|  [EMPTY_BLOB](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/EMPTY_BLOB)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\datatype\Empty_lob\,D:\ysdb\yasft-master\standalone\testcase\lob_object\clob\heap\clob_common\test_sdv_LOB_QR_009.sql,  
|
|  [EMPTY_CLOB](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/EMPTY_CLOB)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\datatype\Empty_lob\,D:\ysdb\yasft-master\standalone\testcase\lob_object\clob\heap\clob_common\test_sdv_LOB_QR_009.sql|
|  [GET_TYPE_NAME](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/GET_TYPE_NAME)  |是|否|  
|  
|没找到|
|  [LOCALTIME](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/LOCALTIME)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function5\localtime\|
|  [LOCALTIMESTAMP](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/LOCALTIMESTAMP)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function5\localtimestamp\|
|  [MD5](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/MD5)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function2\MD5|
|  [SYS_CONNECT_BY_PATH](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/SYS_CONNECT_BY_PATH)  |是|否|  
|  
|D:\ysdb\yasft-master\standalone\testcase\function3\connect_by\cbo_connect_by\,D:\ysdb\yasft-master\standalone\testcase\function3\connect_by\heap\|
|  [SYS_EXTRACT_UTC](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/SYS_EXTRACT_UTC)  |是|否|  
|D:\ysdb\yasft-master\distribution\testcase\unsupport\tac\test_sdv_sys_extract_utc.sql|D:\ysdb\yasft-master\standalone\testcase\function6\sys_extract_utc\heap\|
|  [SOUNDEX](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/SOUNDEX)  |是|否|  
|D:\ysdb\yasft-master\distribution\testcase\function5\test_sdv_soundex\test_sdv_func_soundex_01.sql|D:\ysdb\yasft-master\standalone\testcase\function5\test_sdv_soundex\|
|地理函数|是|否|只有单机heap表支持|D:\ysdb\yasft-master\distribution\testcase\unsupport\lsc\test_sdv_gis_notsupport_tac_01.sql|  
|


### 3) 增加行存表和列存表join，子查询的测试用例

期待：报错，不出现coredump和hang

### 4) 开发在分布式数据库上运行改造后的测试用例得到新增代码覆盖率，根据开发指导，对没有覆盖的分支添加新用例。

### 5)   分布式列表上车工程、单机行表全量用例(不做改造)在分布式数据库跑均没有coredump和hang

# 4. 详细设计

其他dfx设计见     [分布式行表测试概要设计(主要是测试策略) - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153022638)  

# 5. 测试用例

1) 在新工程修改分布式行表原有tac用例：预计数量5000条用例(不含datatype)，6500条用例(含datatype)

2) 在新工程修改单机用例：预计数量2000~3000条用例

~~3) 新增用例：~~    [GET_TYPE_NAME](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/GET_TYPE_NAME)    ~~，~~  ~~sqloader，~~  ~~DBMS_PARAM~~

~~GET_TYPE_NAME:新增用例1条~~

~~sqloader？待确认~~

~~DBMS_PARAM: 新增用例3条? 这个高级包和行表没什么关系。~~

4) 分布式列表上车工程、单机行表全量用例在分布式数据库跑均没有coredump和hang

5) 开发跑代码覆盖率工程，保证新增代码覆盖率。

# 6. 测试框架设计

见     [分布式行表测试概要设计(主要是测试策略) - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153022638)  

# 7. 测试环境说明

# 8. 补充

1) 新增用例，未定

2) JDBC - 李潮已经跑过，跑完后和其他driver测试知会一下。

## Attachments:

[image2024-5-21_15-25-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODE4OTcwYzJhZjRmNTIxOGZmIiwicmVmX2lkIjoiNjczOTZlODE1OTNmOTljOWZmMjM4NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ4LCJleHAiOjE3ODI0NTg3NDh9.mRuVZMv3yfplZprB09dmgjEmGP6deRmK0K_2F5X-6AU)

 (image/png)    


[image2024-5-22_16-19-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODFhMWFkOWEzMzExZGM5NzcwIiwicmVmX2lkIjoiNjczOTZlODE1OTNmOTljOWZmMjM4NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ4LCJleHAiOjE3ODI0NTg3NDh9.6wp6rJlV-fSxWspRNeuo8ILYbKXwbHzYdtq3p_FFC84)

 (image/png)    


[image2024-5-21_14-50-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODE4OTcwYzJhZjRmNTIxOTAwIiwicmVmX2lkIjoiNjczOTZlODE1OTNmOTljOWZmMjM4NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ4LCJleHAiOjE3ODI0NTg3NDh9.gZ0ln0yqmprz7yZckDh3KM1wntHr8pRUOT8LQOV7cEw)

 (image/png)    


[image2024-5-10_16-27-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODFhMWFkOWEzMzExZGM5NzcyIiwicmVmX2lkIjoiNjczOTZlODE1OTNmOTljOWZmMjM4NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ4LCJleHAiOjE3ODI0NTg3NDh9.3Vl7mZFnRmbiPAwBDWNIzDO-OLOt19mvgf1QaNaGlPc)

 (image/png)    


[image2024-5-10_16-29-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODFhMWFkOWEzMzExZGM5Nzc0IiwicmVmX2lkIjoiNjczOTZlODE1OTNmOTljOWZmMjM4NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ4LCJleHAiOjE3ODI0NTg3NDh9.T03s-NKl0HGvsOm6l9DZsNc6mFRwqHJlqRCtbpfBZHs)

 (image/png)    


[image2024-5-10_16-49-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODE4OTcwYzJhZjRmNTIxOTAyIiwicmVmX2lkIjoiNjczOTZlODE1OTNmOTljOWZmMjM4NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ4LCJleHAiOjE3ODI0NTg3NDh9.iBKFRf0qRIZ1KdeShLbGSD-LOZ6OWn3mm96cgB0ySTQ)

 (image/png)    


[image2024-5-10_16-54-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODE4OTcwYzJhZjRmNTIxOTAzIiwicmVmX2lkIjoiNjczOTZlODE1OTNmOTljOWZmMjM4NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ4LCJleHAiOjE3ODI0NTg3NDh9.tTbg68Rul6cWtoiO7E0BiE1Qh_1akshBUhJNPCNbjLU)

 (image/png)    


[image2024-5-10_17-12-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODE4OTcwYzJhZjRmNTIxOTA0IiwicmVmX2lkIjoiNjczOTZlODE1OTNmOTljOWZmMjM4NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ4LCJleHAiOjE3ODI0NTg3NDh9.6P9AZg_DRHJz1Q79O8_6LS9aMyBPXsglpbAeDFtMT3M)

 (image/png)    


[image2024-5-10_18-5-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODFhMWFkOWEzMzExZGM5Nzc5IiwicmVmX2lkIjoiNjczOTZlODE1OTNmOTljOWZmMjM4NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ4LCJleHAiOjE3ODI0NTg3NDh9.zYhlK2zUFIBnTu2YVNmf4XCrwIjH6xsjZmLAo7cGcXw)

 (image/png)    


[replace_tac_lsc_heap.py](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODE4OTcwYzJhZjRmNTIxOTA2IiwicmVmX2lkIjoiNjczOTZlODE1OTNmOTljOWZmMjM4NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ4LCJleHAiOjE3ODI0NTg3NDh9.D0IFtAqQSAM5qvdGmoDAQp48_Co4mybtg94PgZRvYMw)

 (application/octet-stream)    


[image2024-6-11_8-11-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODFhMWFkOWEzMzExZGM5NzdiIiwicmVmX2lkIjoiNjczOTZlODE1OTNmOTljOWZmMjM4NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ4LCJleHAiOjE3ODI0NTg3NDh9.OSgVEsLRcYs0F-u6FYIM-TbHeEDqJLhg8GlHpOVWMVA)

 (image/png)    
