Created by 袁芳达, last modified on 十月 15, 2024

JIRA：    [https://pingcode.yasdb.com/pjm/items/6618ae4afd997db58ad7efd2](https://pingcode.yasdb.com/pjm/items/6618ae4afd997db58ad7efd2)    ?    
  #YDBRD-26119 优化器支持GroupBy下推

# **1. 概述**

原group by下推方案只支持了当group key、aggr来自join同一边的场景下进行下推，本方案将扩展下推场景，使group key、aggr来自join两边的场景下也可以下推

# **2. 需求分**

需求描述： 优化器支持GroupBy/Aggr下推

 需求范围： 1、单机、分布式（？）

需求规格： 1. 实现group by的双边下推（适用于表的记录数量较大下进行join，可以先分组再join） 2.group by下推后优化掉上层group等场景

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=152993884#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- **下推条件**


1. 聚合函数、group key中都不能有null值敏感表达式
1. 聚合函数只能来自于单边
1. full outer join不推


- **消去上层group条件**


1. semijoin
1. group双边下推，且joinkey和group key满足条件
1. 外键和主键join


  


# **4. 测试**  **设计方法**   

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|专项|是否涉及,  
|测试点|
|:---|:---|:---|
|CT|是|1.dml与多表下推并发|
|长稳|否，不涉及新增语法，已有历史用例覆盖|  
|
|一致性|否，不涉及存储底层逻辑变更|  
|
|安全|否，不涉及账户，权限等安全模块|  
|
|HA|否，需求在单机单实例和主备上不存在差异|  
|
|压力|否，需求不会涉及内存及资源占用等模块|  
|
|性能|是|1.验证外场下推场景  
|
|资料|否，不涉及资料修改|  
|


# 4.1   **详细测试设计**

  


|输入条件1|输入条件2|有效等价类|yashan是否下推|Oracle是否下推|备注|
|---|---|---|---|---|---|
|join类型|/|inner join|是|是|  
|
|  
|  
|full join|否|否|  
|
|  
|  
|right join|是|是|  
|
|  
|  
|left join|是|是|  
|
|group key|列|单表单列|是|是|  
|
|  
|  
|单表多列|是|是|  
|
|  
|  
|多表列|是|是|  
|
|  
|  
|函数列|否|否|  
|
|  
|常量|1|否|否|  
|
|  
|表达式|列+const|否|否|  
|
|  
|  
|列+列|否|否|  
|
|  
|  
|列+null|否|否|  
|
|joinkey|连接条件|=|是|是|  
|
|  
|  
|in|是|是|  
|
|  
|  
|>|是|否|  
|
|  
|  
|<|是|否|  
|
|  
|  
|>=|是|否|  
|
|  
|  
|<=|是|否|  
|
|  
|  
|!=,not in ,like,not likeany,some,all|是？|否|  
|
|  
|  
|,is null,is not null,|不影响下推|  
|  
|
|  
|表达式|列+列|否|否|  
|
|  
|  
|列+const|是|是|  
|
|  
|  
|列+null|是|是|  
|
|  
|  
|const|否|否|  
|
|  
|  
|函数列 t1.c1 = abs(t2.c1)|是|是|  
|
|  
|多表join|两表以上|是|是|  
|
|  
|  
|边界值|是|是|  
|
|  
|  
|嵌套join|否？|否|  
|
|  
|group key|包含group key|是|是|  
|
|  
|  
|不包含group key|是|是|  
|
|aggr|aggr类型|AVG|是|是|  
|
|  
|  
|COUNT|是|是|  
|
|  
|  
|GROUP_CONCAT|否|否|  
|
|  
|  
|MAX|是|是|  
|
|  
|  
|MIN|是|是|  
|
|  
|  
|STDDEV|否|否|  
|
|  
|  
|STDDEV_POP|否|否|  
|
|  
|  
|STDDEV_SAMP|否|否|  
|
|  
|  
|SUM|是|是|  
|
|  
|  
|SUM_SQUARE|否|否|  
|
|  
|  
|VARIANCE|否|否|  
|
|  
|  
|VAR_POP|否|否|  
|
|  
|  
|VAR_SAMP|否|否|  
|
|  
|参数类型|单表列|是|是|  
|
|  
|  
|多表列|否|否|  
|
|  
|  
|常量|是|是|  
|
|  
|  
|null|是|是|  
|
|  
|  
|*|是|是|  
|
|  
|  
|列+列|是|是|  
|
|  
|  
|列+const|是|是|  
|
|  
|  
|列+null|是|是|  
|
|  
|  
|NULl值敏感|？|  
|  
|
|WHERE|FILTER 类型|=,<,>,<=,>=,!=,like,not like,between ...and,is null, is not null,in, not in, ,any,all,some，order by,  
|是|是|  
|
|  
|  
|rownum,exists subquery ，not exists subquery,limit（Oracle用FETCH FIRST 2 ROWS ONLY）|否|否|  
|
|  
|  
|  
|  
|  
|  
|


2.消去上层group --之前单边下推的场景，待坤宇补充

|输入条件1|输入条件2|有效等价类|是否消去上层group|备注|
|---|---|---|---|---|
|join条件 = |group key|主键|是|组合优化后生成join条件=|
|  
|  
|唯一键|是|  
|
|  
|  
|唯一索引|？|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|


  


  


  


# 5.   **测试用例**

  


# 6.   **测试框架设计**

本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Comments:

|  [](null)  ,1.group和join之间有其他算子是否下推,2.投影列和多种aggr组合,3.默认的和收集统计信息,4.行列表，表类型,5.join表是子查询，udt 数据类型,Posted by yuanfangda at 七月 10, 2024 14:51|
|---|


