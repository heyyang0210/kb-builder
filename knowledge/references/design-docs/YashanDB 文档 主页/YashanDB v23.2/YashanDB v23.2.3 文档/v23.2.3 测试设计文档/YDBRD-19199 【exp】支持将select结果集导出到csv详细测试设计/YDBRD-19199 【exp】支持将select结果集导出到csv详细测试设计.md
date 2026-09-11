Created by 范瑜, last modified on 七月 10, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/661156dd579a3edb84d68e37](https://pingcode.yasdb.com/pjm/items/661156dd579a3edb84d68e37)    ?    
  #YDBRD-19199 【exp】支持将select结果集导出到csv

开发设计：    [复制从 exp csv 导出结果集 - 程康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153022406)  

需求背景：   提供查询sql，查询结果集可以导出为csv

交付版本：23.2.3.100

交付形态：分布式

# 2. 需求分析

## 2.1 功能点分析

exp --csv新增如下参数

|命令参数|作用|校验规则|备注|
|---|---|---|---|
|--query , -q|支持单条sql语句,**限制**  ：仅支持单行语句，不支持有注释、换行,**取值**  ：任意支持的查询语句|（1）与-O -T互斥，   同时指定报错,（2）use-thread指定不生效， use-thread=1,（3）  支持表名前指定schema，不指定schema时 默认schema为 -u,（4）查询语句需要双引号包围，需要注意查询语句中的转义字符|  
|
|--query-file, -qf|sql文件,支持换行、注释,**取值：**  用户指定的sql文件路径|（1）与-O -T互斥，   同时指定报错,（2）use-thread指定不生效，  use-thread=1,（3）表所属用户默认为登录用户， 用户权限以登录用户的权限为主|  
|
|--query-out-file, -qo|输出结果集文件（  文件名  ）,**取值：**  用户指定的文件， 默认：  outfile|（1）-q或-qf指定时生效,（2）与-T互斥，  指定不会生效，不会报错|  
|


## 2.2 应用场景

主要应用场景：   提供查询sql，查询结果集可以导出为csv

其他特性关联场景：

（1）  *-*  -lob：  设置LOB数据的导出方式，可选值lls/csv

（2）--inline-blob：  当--lob为CSV时，设置BLOB数据的导出方式，可选值binary/string，默认值binary

（3）–csv optioin：包围符、列分割符、行终止符、日期格式、时间格式、时间戳格式

（4）  配置文件， 可以指定query、query-file、query-out-file

## 2.3 规格约束

（1）输入的sql仅支持dql

（2）支持命令行输入和配置文件输入

（3）  不涉及修改导出文件路径的逻辑，可用 -F 配置导出路径？？     

-F  /data   --query-out-file test.csv

输出文件为：/data/test.csv

（4）支持指定分隔符、包围符

（5）导出文件名不指定则默认为outfile

（6）sql长度限制2M

# 3. 详细测试设计

## 3.1 测试设计方法

（1）功能测试使用场景法进行测试分析和设计。

（2）新增命令参数使用边界值方法测试参数，配置生效情况需要结合场景法进行测试

### 3.1.1 功能测试

除了有特殊说明， 以下场景都是在配置项正确情况下导出

|序号|测试项|测试子项|观察点|备注|
|---|---|---|---|---|
|1|导出对象|1、表存储类型：heap、lsc、tac,2、分布式类型：分布表、复制表,3、表类型：非分区表、分区表、临时表、外部表,4、视图：系统视图、自定义视图、物化视图,  
|1、除了私有临时表外，都导出成功|1、主要测试heap表， 其它表类型验证基本功能可用即可,2、导出成功或者失败， 需要查看状态码,导出成功为0， 导出失败为非0|
|2|sql语句|1、sql语句类型：,（1）dql,（2）ddl,（3）dml,（4）dcl,2、非sql语句类型：plsql等,  
|1、dql导出成功,2、其它类型和非sql语句类型导出失败|  
|
|3|  
|dql操作类型：,（1）多表连接（子查询、集合、join等）,（2）排序,（3）分组,（4）case,（5）limit,（6）cte,（7）层次化/递归查询,（8）抽样,（9）指定分区,（10）指定切片,  
|导出成功，且结果正确|  
|
|4|  
|1、投影列形式：,（1）表列,（2）常量,（3）伪劣,（4）表达式：算术表达式、函数表达式：普通函数、聚合函数、窗口函数等,（5）投影列类型经过表达式后数据类型有变化，如：varchar类型转换成clob等,2、投影列类型：,（1）数值类型：  整数类型、浮点类型、number类型,（2）布尔类型,（3）  日期类型：  日期时间类型、间隔类型,（4）字符型：  定长类型、非定长类型,（5）大对象类型：  clob、nclob、blob,（6）xml、json类型,（7）  ROWID/UROWID,（8）  udt/ST_GEOMETRY,3、投影列值：null、数据类型边界值、特殊值、存在换行、包含分隔符或者包围符、存在需要转义的字符等,4、投影列值长度：,（1）数据类型长度,（2）大对象类型：行内、行外、大于2M等,5、投影列数：小于4096、等于4096,  
|1、除了udt外，都导出成功|  
|
|5|  
|1、表个数：小于127， 等于127、大于127|1、不大于127，导出成功,2、大于127导出失败|  
|
|6|  
|查询条件：,（1）算术表达式,（2）函数表达式,（3）布尔表达式等,  
|导出成功|  
|
|7|  
|对象名称及条件内容：中文、单双引号、特殊字符等|导出成功|  
|
|8 |  
|单行数据大小：,（1）小于等于63k,（2）大于63k,（3）含lob对象大于2M？|  
|  
|
|9|  
|1、sql语句长度：,（1）不大于2M,（2）大于2M,2、sql语句内容：,（1）单纯sql语句,（2）带有注释， 覆盖：英文、中文、sql语句等|1、不大于2M导出成功，大于2M导出失败|  
|
|10|权限|1、表所属用户与登录用户一致,2、表所属用户（sql语句带schema）与登录用户不一致,（1）登录用户有表的select 权限,（2）登录用户无表的select权限|1、导出成功,2、,（1）导出成功,（2）导出失败|  
|
|11|导出文件大小|大小：,（1）小于2M,（2）大于2M, 倍数|导出成功|  
|
|12|数据库配置|1、数据库资源充足， 如vm_buffer_size等,2、数据库资源不足， 如vm_buffer_size等|1、导出成功,2、导出失败， 报错信息合理|  
|
|13|结合其它导出功能|*-*  -lob：  设置LOB数据的导出方式，可选值lls/csv|导出成功|  
|
|14|  
|--inline-blob：  当--lob为CSV时，设置BLOB数据的导出方式，可选值binary/string，默认值binary|导出成功|  
|
|15|  
|–csv optioin：包围符、列分割符、行终止符、日期格式、时间格式、时间戳格式|导出成功|  
|
|16|其它项|用户不存在|导出失败|  
|
|17|  
|表不存在|导出失败|  
|
|18|  
|空表|导出成功|  
|
|19|  
|表损坏|导出失败|  
|
|20|  
|版本兼容（暂时不用测试，后续有版本兼容性SR）：,（1）高版本exp --csv， 连低版本服务端,（2）低版本exp --csv， 连高版本服务端|导出成功|  
|
|21|  
|在备机上导出|导出成功|  
|


### 3.1.2 参数校验

|命令参数|作用|校验规则|有效类|备注|无效类|备注|
|---|---|---|---|---|---|---|
|--query , -q|支持单条sql语句,**限制**  ：仅支持单行语句，不支持有注释、换行,**取值**  ：任意支持的查询语句|（1）与-O -T互斥，   同时指定报错,（2）use-thread指定不生效， use-thread=1,（3）  支持表名前指定schema，不指定schema时 默认schema为 -u,（4）查询语句需要双引号包围，需要注意查询语句中的转义字符|1、命令参数大小写,2、简写大小写,3、命令重复|  
|1、指定-O、-q,2、指定-O、-T、-q,3、指定–query，值为空串、非sql语句等,4、单引号包围（不涉及转义会成功）、或者无符号包围,5、换行有注释|  
|
|--query-file, -qf|sql文件,支持多行语句、注释,**取值：**  用户指定的sql文件路径|（1）与-O -T互斥，   同时指定报错?,（2）use-thread指定不生效，  use-thread=1,（3）表所属用户默认为登录用户， 用户权限以登录用户的权限为准|1、命令参数大小写,2、简写大小写,3、命令重复,4、单纯sql语句、sql语句带注释,5、路径,（1）内容：带有中文或者特殊字符,（2）形式：相对路径、绝对路径,（3）长度：小于256,（4）权限：有rx权限,（5）文件是否存在：存在,6、命令重复,7、同时指定-q、-qf（  同时指定以-q为准  ）|  
|1、sql文件内容为空,2、sql文件内容格式不正确,3、sql长度大于2M,4、路径：,（3）长度：大于256,（4）权限：有目录权限无文件rx权限； 无目录权限,（5）文件是否存在：文件不存在、目录不存在,（6）指定的是目录,5、指定-O、-T、-qf|  
|
|--query-out-file, -qo|输出结果集文件,**取值：**  用户指定的文件， 默认：  outfile,文件名|（1）-q或-qf指定时生效,（2）与-T互斥，  同时指定报错？|1、命令参数大小写,2、简写大小写,3、命令重复,4、路径,（1）内容：带有中文或者特殊字符,~~（2）形式：相对路径、绝对路径~~,~~（3）长度：小于256~~,~~（4）权限：有权限~~,（5）文件是否存在：存在、不存在,6、命令重复,7、同时指定-qo、-F ,8、不指定-qo、-F ,9、指定-F ，不指定-qo|  
|1、不指定-q、-qf、-O、-T， 指定-qo,2、指定-O、-T、qo,3、路径：,（3）长度：大于256,（4）权限：有目录权限无文件wx权限； 无目录权限,（5）文件是否存在：目录不存在,（6）指定与目录重名|  
|
|参数组合|  
|  
|1、配置文件和命令行组合  （文件优先级低于命令行）,（1）参数重复,（2）参数不重复|  
|  
|  
|


### 3.1.3 异常/并发测试

|序号|场景|预期|
|---|---|---|
|1|带普通列/lob列，导出过程中，dml对象|导出成功|
|2|带普通列/lob列，导出过程中，ddl对象|导出成功|
|3|带普通列/lob列，导出文件大小超过2M，导出过程中，磁盘满|导出进程正常退出，报错合理|
|4|带普通列/lob列，导出文件大小超过2M，导出过程中，数据库状态异常|导出进程正常退出，报错合理|
|5|带普通列/lob列，导出文件大小超过2M，导出过程中，ctl+c|导出进程正常终止|


### 3.1.4 性能测试

|序号|场景|预期|
|---|---|---|
|1|tpch模型，查询所有列|与exp --csv之前性能相差不大|
|2|lob模型，lls模式， 查询所有列|与exp --csv之前性能相差不大|


  


  


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|测试点|
|:---|:---|:---|
|CT|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|是|同上一章节|
|HA|  
|  
|
|压力|  
|  
|
|性能|是|同上一章节|
|可维护性|  
|  
|


  


# 4. 测试用例

[YDBRD-19199 【exp】支持将select结果集导出到csv文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWU4OTcwYzJhZjRmNTIwZjJkIiwicmVmX2lkIjoiNjczOTZjZWU1OTNmOTljOWZmMjM3NTNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzgyLCJleHAiOjE3ODIzOTExODJ9.pNQqxWRHyDh1VTPEVRChPiOT-0SoHQVSGv-K8UA6BPs)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  


## Attachments:

[YDBRD-19199 【exp】支持将select结果集导出到csv文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWU4OTcwYzJhZjRmNTIwZjJkIiwicmVmX2lkIjoiNjczOTZjZWU1OTNmOTljOWZmMjM3NTNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzgyLCJleHAiOjE3ODIzOTExODJ9.pNQqxWRHyDh1VTPEVRChPiOT-0SoHQVSGv-K8UA6BPs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：冯皓博、史鑫、程康、谢昭贤、范瑜    
  评审时间：2024.05.31 11:00:00    
  评审地点：线上会议    
  评审纪要信息：    
  1、--query-out-file指定的是文件名    
  2、  文件优先级低于命令行    
  3、-q、-qf与-O -T互斥，     同时指定报错    
  4、  同时指定-q、-qf， 以-q为准,5、版本兼容（暂时不用测试，后续有版本兼容性SR）,Posted by fanyu at 五月 31, 2024 15:30|
|---|
