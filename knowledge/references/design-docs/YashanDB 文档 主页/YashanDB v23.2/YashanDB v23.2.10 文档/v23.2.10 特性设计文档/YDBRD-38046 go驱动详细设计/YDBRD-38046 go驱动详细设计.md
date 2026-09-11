##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

  [https://pingcode.yasdb.com/pjm/items/67ac16b12652bc4f39ffa8e1?](https://pingcode.yasdb.com/pjm/items/67ac16b12652bc4f39ffa8e1?)  

#YDBRD-38046 【已上车，待补充开发测试设计文档后走单】【驱动】支持GO驱动和GORM框架

来源于龙华区政数局。  


###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

主要根据c驱动已实现的接口，实现go驱动，方便客户使用golang程序直接连接崖山数据库。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|关键技术点|特性是否涉及|
|:---|:---|:---|:---|
|兼容性|----|是/否|否|
|功能|golang连接崖山数据库|是|是|
|可修改性|----|是/否|否|
|可用性|恢复场景|是/否|否|
|可维可测|DFX功能1|是/否|否|
|可靠性|故障场景|是/否|否|
|周边配合|权限|----|否|
|周边配合|审计|----|否|
|周边配合|导入导出工具|----|否|
|安全|安全场景1|是/否|否|
|易用性|----|是/否|否|
|  
|DFX功能2|是/否|否|




﻿

###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

|#|Interface|函数/属性名称|函数|目标|支持情况|说明|
|---|---|---|---|---|---|---|
|1|Driver|Open|Open(name string) (Conn, error)|打开数据库连接|已支持|﻿  
|
|2|DriverContext|OpenConnector|OpenConnector(name string) (Connector, error)|打开数据库连接|未支持|和Open功能一致，暂无需支持|
|3|Connector|Connect|Connect(context.Context) (Conn, error)|返回连接数据库的Conn。|已支持|﻿  
|
|4|﻿  
|Driver|Driver() Driver|返回Driver对象|已支持|﻿  
|
|5|Pinger |Ping|Ping(ctx context.Context) error|数据库连接探测|已支持|﻿  
|
|6|Conn|Prepare|Prepare(query string) (Stmt, error)|准备返回绑定到此连接的准备好的语句。|已支持|﻿  
|
|7|﻿  
|Close|Close() error|标记连接不再使用|已支持|﻿  
|
|8|﻿  
|Begin|Begin() (Tx, error)|启动并返回一个新事务。|已支持|﻿  
|
|9|ConnPrepareContext|PrepareContext|PrepareContext(ctx context.Context, query string) (Stmt, error)|返回此连接上准备好的statement|已支持|﻿  
|
|10|ConnBeginTx |BeginTx|BeginTx(ctx context.Context, opts TxOptions) (Tx, error)|支持带TxOptions启动并返回一个新事务。|已支持|﻿  
|
|11|SessionResetter |ResetSession|ResetSession(ctx context.Context) error|重置连接|已支持|﻿  
|
|12|Result|LastInsertId|LastInsertId() (int64, error)|返回数据库自动生成的ID|未支持|﻿  
|
|13|﻿  
|RowsAffected|RowsAffected() (int64, error)|返回受影响的行数|已支持|﻿  
|
|14|Stmt|Close|Close() error|关闭statement|已支持|﻿  
|
|15|﻿  
|NumInput|NumInput() int|返回SQL占位符参数的个数|未支持|﻿  
|
|16|﻿  
|Exec|Exec(args []Value) (Result, error)|执行数据库操作，不返回结果集|已支持|待废弃接口|
|17|﻿  
|Query|Query(args []Value) (Rows, error)|执行数据库操作，返回结果集|已支持|待废弃接口|
|18|StmtExecContext |ExecContext|ExecContext(ctx context.Context, query string, args []NamedValue) (Result, error)|带上下文执行Exec|已支持|﻿  
|
|19|StmtQueryContext |QueryContext|QueryContext(ctx context.Context, query string, args []NamedValue) (Rows, error)|带上下文执行Query|已支持|﻿  
|
|20|NamedValueChecker|CheckNamedValue|CheckNamedValue(*NamedValue) error|在传给数据库前进行参数检查|已支持|﻿  
|
|21|ColumnConverter|ColumnConverter|ColumnConverter(idx int) ValueConverter|将Go类型转换为数据库类型|未支持|待废弃接口|
|22|Rows|Columns|Columns() []string|返回列的名称。|已支持|﻿  
|
|23|﻿  
|Close|Close() error|关闭Rows的迭代器|已支持|﻿  
|
|24|﻿  
|Next|Next(dest []Value) error|遍历结果集下一行数据，将下一行数据填充到提供的列表中|已支持|﻿  
|
|25|RowsNextResultSet |HasNextResultSet|HasNextResultSet() bool|返回当前结果集之后是还有另一个结果集|未支持|暂不支持多结果集|
|26|﻿  
|NextResultSet|NextResultSet() error|将遍历推进到下一个结果集|未支持|暂不支持多结果集|
|27|﻿  
|ColumnTypeScanType|ColumnTypeScanType(index int) reflect.Type|返回该列的映射类型|已支持|﻿  
|
|28|RowsColumnTypeDatabaseTypeName |ColumnTypeDatabaseTypeName|ColumnTypeDatabaseTypeName(index int) string|返回列的数据库类型名称|已支持|﻿  
|
|29|RowsColumnTypeLength |ColumnTypeLength|ColumnTypeLength(index int) (length int64, ok bool)|返回是否为可变长类型和其类型长度|已支持|﻿  
|
|30|RowsColumnTypeNullable |ColumnTypeNullable|ColumnTypeNullable(index int) (nullable, ok bool)|返回该列是否可以为空|已支持|﻿  
|
|31|RowsColumnTypePrecisionScale |ColumnTypePrecisionScale|ColumnTypePrecisionScale(index int) (precision, scale int64, ok bool)|返回是否具备精度的类型和精度、小数位数|已支持|﻿  
|
|32|Tx|Commit|Commit() error|事务提交|已支持|﻿  
|
|33|﻿  
|Rollback|Rollback() error|事务回滚|已支持|﻿  
|




  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

无。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

见接口。

下载方法：

- 通过go get命令在  `https://git.yasdb.com/go/yasdb-go`  仓库中下载；
- 离线下载源码包；


使用方法：

yasdb-go驱动包中提供了一些使用示例。其中通过标准库database/sql连接操作yashandb示例请参考项目中examples目录。



##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1、基本功能测试，能正常编译，基本功能正常就代表不存在语法兼容性问题了。

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

不涉及资料改动

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。



  
