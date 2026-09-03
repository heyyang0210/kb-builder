Created by 李攀, last modified on 七月 03, 2023

SR链接：

  [https://jira.yasdb.com/browse/YDBRD-13704](https://jira.yasdb.com/browse/YDBRD-13704)  

  [https://jira.yasdb.com/browse/YDBRD-13703](https://jira.yasdb.com/browse/YDBRD-13703)  

设计文档地址：    [YDBRD-13704/YDBRD-13703:limit与rownum下推到DN或并行执行设计文档 - 陈芊宇 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=112726675)  

  


# **1. 概述**

描述limit与rownum下推到DN或并行执行的测试设计。

  


# **2. 需求分析**

将limit offset、top sort、count stopkey下推到并行之下或者分布式的DN节点上

  


##   [2.1 Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=112726675#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

将rownum和limit offset下推至并行的PX之下或者分布式的DN上执行。

|算子形式|支持部署形式|
|:---|:---|
|count本层仅在有rownum|列存并行、分布式(当前分布式不支持count)|
|count下层含有rownum|不下推|
|limit|列存并行、分布式|
|limit offset|列存并行、分布式|
|top sort|列存并行、分布式|
|limit [offset] + count|列存并行、分布式|


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=112726675#3-interfaces%E6%8E%A5%E5%8F%A3)  

直接使用SQL语句。

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=112726675#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

  


  


limit [offset] + count情况下，下推count(count需要满足第一条和第二条的要求)

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=112726675#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 count算子](https://conf.yasdb.com/pages/viewpage.action?pageId=112726675#51-count%E7%AE%97%E5%AD%90)  

count算子下推规则：

1. count stopkey会被下推；
1. count不会被下推；


###   [5.2 window算子](https://conf.yasdb.com/pages/viewpage.action?pageId=112726675#52-window%E7%AE%97%E5%AD%90)  

window算子下推规则：

1. limit n 会被下推，n>=1；
1. limit n offset m 会下推limit n+m，n>=1；
1. limit n [offset m]当n<1时，会增加result，其上挂filter(false)（并行与非并行都做）；
1. limit n [offset m] + count 会下推count，遵循的count下推规则。


m, n满足limit offset规格。

打印window信息。

###   [5.3 对参数的处理](https://conf.yasdb.com/pages/viewpage.action?pageId=112726675#53-%E5%AF%B9%E5%8F%82%E6%95%B0%E7%9A%84%E5%A4%84%E7%90%86)  

####   [5.3.1 rownum](https://conf.yasdb.com/pages/viewpage.action?pageId=112726675#531-rownum)  

对于rownum，rownum cmp param这种情况本身挂在result上，所以本方案不涉及rownum cmp param下推。

####   [5.3.2 window](https://conf.yasdb.com/pages/viewpage.action?pageId=112726675#532-window)  

分情况讨论：

1. limit param [offset n]


下推为limit TO_NUMBER(param)[+n]

1. limit n offset param


下推为limit n+GREATEST(FLOOR(TO_NUMBER(param)),0)

1. limit param1 offset param2


下推为limit TO_NUMBER(param1)+GREATEST(FLOOR(TO_NUMBER(param2)),0)

这与oracle有一定的区别，oracle增加出的是TO_NUMBER(GREATEST(TO_CHAR(FLOOR(TO_NUMBER(:1))),'0'))

###   [5.4 路径增加](https://conf.yasdb.com/pages/viewpage.action?pageId=112726675#54-%E8%B7%AF%E5%BE%84%E5%A2%9E%E5%8A%A0)  

增加下推的路径与不下推的路径。

  


# 3.   **测试设计方法**   

等价类划分

单机：

|部署形态|输入条件|有效等价类|是否下推|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|单机heap,待确认？|hint parallel|limit |下推  并行的PX之下|  
|  
|
|  
|  
|limit offset|下推  并行的PX之下|  
|  
|
|  
|  
|top sort|下推  并行的PX之下|  
|  
|
|  
|  
|count stopkey本层仅在有rownum|  
|count下层含有rownum|不下推|
|  
|  
|limit [offset] + count(count本层仅在有rownum)|下推count到  并行的PX之下|limit [offset] + count(count下层含有rownum)|不下推|
|单机lsc,tac|hint parallel|limit |  
|  
|  
|
|  
|  
|limit offset|  
|  
|  
|
|  
|  
|top sort|  
|  
|  
|
|  
|  
|count本层仅在有rownum|  
|count下层含有rownum|不下推|
|  
|  
|limit [offset] + count(count本层仅在有rownum)|  
|  
|  
|
|分布式|hint parallel|limit,limit offset,top sort,count本层仅在有rownum|下推到dn|count下层含有rownum|不下推|
|  
|串行|limit,limit offset,top sort,count本层仅在有rownum|下推到dn|  
|  
|
|  
|规则验证count算子|count stopkey|下推|  
|  
|
|  
|  
|count|不下推|  
|  
|
|  
|window算子|limit n ,  n>=1；,2,1.5,1,1+1,  
|下推|limit n ,  n<1；|不下推|
|  
|  
|limit n offset m ,n>=1；|会下推|imit n [offset m]  ,n<1|会增加result，其上挂filter(false)（并行与非并行都做）；|
|  
|  
|limit n [offset m] + count stopkey,rownum<col limit n, n=1, rownum<col limit n, n<1, rownum<col limit n, n>1|会下推count|limit n [offset m] + count |不下推count|
|  
|  
|offset 参数取值： 表达式  ，大于,  
,,,,  
|  
|limit n offset m ,n,m不满足limit offset  规则,：,n,m为非num的值,null |  
|
|  
|rownum表达式|rowNum>m时 m>=1,  
|恒false ，不下推|  
|  
|
|  
|  
|rowNum>m时 m<1|全表，不下推|  
|  
|
|  
|  
|rowNum>=m时 m<=1|全表，是否下推|  
|  
|
|  
|  
|rowNum>=m时 m>1|恒false ，不下推|  
|  
|
|  
|  
|当rownum<M,  M>0时|下推|  
|  
|
|  
|  
|当rownum<M,  M<=0时|恒为false，不下推|  
|  
|
|  
|  
|当rownum<=M,  M>0时|下推|  
|  
|
|  
|  
|当rownum<=M,M<=0时|恒为false|  
|  
|
|  
|  
|当rownum=M,当M=1时，选出表的首行,当M≠1时，恒为false|  
|  
|  
|
|  
|  
|当rownum!=M,- 当M∈{x|x∉N+}时，选出全表
- 0，-1，
|全表，是否下推？|  
|  
|
|  
|  
|当rownum!=M,当M∈{x|x∈N+}时，相当于rownum<M,1,2,5.6|下推|null|  
|
|  
|  
|filter ,in/not in,and,or,like/not like ,between and|  
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
|场景 ，不支持并行的算子和支持的确定|group by|  
|  
|  
|
|  
|列存支持的并行算子|merge join|  
|  
|  
|
|  
|  
|NESTLOOP_JOIN|  
|  
|  
|
|  
|  
|HASH JOIN |  
|  
|  
|
|  
|  
|top  sort distinct|  
|  
|  
|
|  
|  
|union,union all|  
|  
|  
|
|  
|  
|子查询,1.子查询在投影列  ,2.from 子查询,3. filter 子查询|  
|  
|  
|
|  
|  
|与 order by 组合 ,order by rownum ,  
|  
|  
|  
|
|  
|  
|connect by|  
|  
|  
|
|  
|  
|cte|  
|  
|  
|
|  
|  
|view的情况|  
|  
|  
|
|  
|  
|收集统计信息后|  
|  
|  
|
|  
|  
|索引的情况|  
|  
|  
|
|  
|  
|聚合函数|  
|  
|  
|
|  
|  
|窗口函数|  
|  
|  
|
|  
|  
|绑定参数|  
|  
|  
|
|  
|表类型|分区表：,hash,list,range,二级分区表|  
|  
|  
|
|  
|  
|分布式分布表|  
|  
|  
|
|  
|  
|分布式复制表|  
|不下推|  
|
|  
|  
|  
|  
|  
|  
|


# 4.   **详细测试设计**

  


# 5.   **测试用例**

文本用例：

  


[limit_rownum_push.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjA4OTcwYzJhZjRmNTFmN2I1IiwicmVmX2lkIjoiNjczOTY5NWY3MjgyMDZlZmI5MmVmMjZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2OTY0LCJleHAiOjE3ODIyMTMzNjR9.BWE2toj9HRPHJ7Qfm0DZBfh8LYjUx9RZ56AICkQMJb0)

# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[limit_rownum_push.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjA4OTcwYzJhZjRmNTFmN2I1IiwicmVmX2lkIjoiNjczOTY5NWY3MjgyMDZlZmI5MmVmMjZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2OTY0LCJleHAiOjE3ODIyMTMzNjR9.BWE2toj9HRPHJ7Qfm0DZBfh8LYjUx9RZ56AICkQMJb0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
