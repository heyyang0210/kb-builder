Created by 孔珂煜, last modified on 十一月 08, 2023

# 1.   **概述**

描述insert into多个values实现基于value的分发优化测试设计

sr：    [YDBRD-13632](https://jira.yasdb.com/browse/YDBRD-13632?src=confmacro)    -  Insert into多个value实现基于value的分发优化  完成

# 2.   **需求分析**

1.SQL直接执行的情况：对每个DN，CN只会向其发送在这个DN上需要真正执行insert的数据行，减少网络IO开销和计算开销

2.绑定参数执行：  实现真正的批量插入，即通过单次的协议交互来完成批量数据插入，大幅提升insert的时间效率；同时：每个DN，只会收到其需要真正执行insert的那部分行的数据

分布式部署

# 3.   **测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

# 4.   **详细测试设计**

1.SQL直接执行

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|---|---|
|表类型|  
|  
|  
|  
|
|  
|分布表|  
|  
|  
|
|  
|复制表|  
|  
|  
|
|约束|唯一约束|  
|  
|  
|
|  
|主键|  
|  
|  
|
|  
|check|  
|  
|  
|
|  
|not null|  
|  
|  
|
|索引|单列索引|  
|  
|  
|
|  
|复合索引|  
|  
|  
|
|  
|函数索引|  
|  
|  
|
|插入情况|全部插入成功|  
|  
|  
|
|  
|一条insert 部分插入成功，部分插入失败|预期全失败|  
|  
|
|  
|一条insert 全部插入失败|  
|  
|  
|
|数据量|单行，10行，1000行，10000行|行数限制 ,SQL长度限制2M|  
|  
|
|数据分布|无重复数据|  
|  
|  
|
|  
|少量重复数据|  
|  
|  
|
|  
|大量重复数据|  
|  
|  
|
|数据类型|char，varchar|各数据类型的边界值|  
|  
|
|  
|tinyint，smallint，int，bigint|  
|  
|  
|
|  
|number|  
|  
|  
|
|  
|float，double|  
|  
|  
|
|  
|time，timestamp，date|  
|  
|  
|
|  
|clob|32000大小限制  |blob|  
|
|  
|json|列存260k|udt|  
|
|  
|boolean|  
|bit|  
|
|投影列数量|投影列个数相等|  
|投影列个数不相等|  
|
|  
|4096列|  
|  
|  
|
|投影列类型|单列|  
|  
|  
|
|  
|表达式列，函数列|普通函数，聚集函数，窗口函数|  
|  
|
||伪列|rownum ， rowid ，rowscn|  
|  
|
|  
|标量子查询|  
|  
|  
|
|  
|常量|  
|  
|  
|
|  
|sysdate，systimestamp|select count(*) |  
|  
|
|  
|null|  
|  
|  
|


2.JDBC绑定参数

|模式|作用|  
|
|---|---|---|
|isBatchError = false|insert100行数据，第60行时出错：    
  isBatchError == false： insert了前59行， 后40行不再继续insert；|  
|
|isBatchError = true|insert100行数据，第60行时出错：,isBatchError == true： 继续insert后面的40行数据。|1000行,复制表一个报错，一批都不会插入成功,分布表只影响一行,节点异常的时候都会回滚掉|
|接口|  
|  
|
|addBatch|  
|  
|
|executeBatch|  
|  
|
|clearBatch|  
|  
|
|输入条件|有效等价类|备注|
|插入内容|全部绑定变量插入|  
|
|  
|部分绑定变量插入,部分直接插入|  
|
|  
|全部直接插入|  
|
|插入情况|全部插入成功|  
|
|  
|插入部分成功，部分出错|  
|
|  
|全部插入失败|  
|
|数据跨包|addBatch执行完，执行ddl，再执行executeBatch|128K的数据会跨包|
|  
|addBatch执行一部分，执行ddl，再执行addBatch，执行executeBatch|  
|
|  
|addBatch，执行ddl，clearBatch, addBatch，executeBatch|  
|
|  
|addBatch，clearBatch, 执行ddl，addBatch，executeBatch|  
|
|数据跨包类型|单行跨包|  
|
|  
|多行跨包|  
|
|参数个数|1个，4096个|缺省插入,全部插入,性能慢,参数个数参考之前，保持一致|
|性能|和之前的执行时间做对比|3~5倍性能差别,不够3倍需要具体分析,5个，10个，100个,一个batch至少100个|


3.日志测试

trace日志里记录每个DN实际insert的次数，查看trace的记录和DN的数据是否一致

5.  ** 测试用例设计**

# 6.   **测试框架设计**

  


# 7.   **测试环境说明**