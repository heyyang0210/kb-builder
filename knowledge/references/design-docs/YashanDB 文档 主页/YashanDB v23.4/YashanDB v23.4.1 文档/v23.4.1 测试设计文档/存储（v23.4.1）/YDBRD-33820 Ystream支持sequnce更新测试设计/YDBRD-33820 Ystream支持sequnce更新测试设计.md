Created by 赵楠, last modified on 十一月 06, 2024

# 1.   **概述**

本文描述Ystream支持sequence更新测试设计

现状：  Ystream以一定格式输出sequence对象的值，以便目标端能更新sequence的值

  


# 2.   **需求分析**

IR链接：

  [https://pingcode.yasdb.com/pjm/items/670781e9e489dd0868f3d1fd](https://pingcode.yasdb.com/pjm/items/670781e9e489dd0868f3d1fd)    ?    
  #YDBRD-33820 Ystream支持sequence更新

开发文档：

需求来源：  内部需求

部署形态：  单机 、集群

场景：Ystream以一定格式输出sequence对象的值，以便目标端能更新sequence的值

功能说明：Ystream支持sequence更新

Ystream解析sequence相关信息

# 3.   **测试设计方法**

1. Ystream支持sequence更新功能、异常场景  使用场景法和错误推测法设计
1. 表类型：覆盖heap、lsc表（带slice）
1. 覆盖  sequence的所有操作，查看  ystream的解析结果中是否有关于sequence的信息，以及sequence值是否准确
1. DFX覆盖


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|涉及|
|压力|  
|
|性能|  
|
|可维护性|  
|
|资料|涉及|


# 4.   **详细测试设计**

测试观测点：

- 主机序列值变化，Ystream能正常显示解析sequnce值信息，信息明确
- 视图：DBA_SEQUENCES


|  
|部署形态|测试场景|预期|备注|
|:---|:---|:---|:---|:---|
|1|单机|建表带自增列单个、多个sequence default sequence..NEXTVAL，插入数据序列值依次增加|Ystream能正常显示解析sequnce值信息|  
|
|2|  
|创建序列为升序序列、降序序列、指定步长值序列，是否循环序列号，到达  MAXVALUE|Ystream能正常显示解析sequnce值升序、降序，步长值、以及  MAXVALUE|  
|
|3|  
|建表后修改表中自增列约束default null ，插入数据无序列值|Ystream能正常显示解析sequnce值信息|  
|
|4|  
|建表无自增列，修改表添加 alter table modify coloumn default sequence..NEXTVAL，  插入删除更新数据||  
|
|  
|  
|建表无自增列，  alter table add/drop column带序列值，插入删除更新数据||  
|
|5|  
|ALTER SEQUENCE 修改序列的参数值（增量值，最大值、最小值等）||  
|
|6|  
|DROP SEQUENCE 删除序列||  
|
|13|集群|覆盖以上场景|  
|  
|
|  
|分布式|建表带自增列单个、多个sequence default sequence..NEXTVAL，插入数据序列值依次增加|Ystream不能显示解析sequnce值信息|  
|
|16|/|资料测试|  
|  
|


# 5.  ** **  **测试用例设计**

文本用例

# 6.   **测试框架设计**

使用regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 8.   **测试工作量评估**

5人天：

测试设计+评审 1

测试执行+上车 4