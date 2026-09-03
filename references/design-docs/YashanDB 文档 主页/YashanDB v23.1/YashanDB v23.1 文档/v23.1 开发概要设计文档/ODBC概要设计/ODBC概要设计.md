## 一、模块简述：

ODBC（Open Database Connectivity，开放数据库互连）提供了一种标准的API（应用程序编程接口）方法来访问DBMS(Database Management System)。这些API利用SQL来完成其大部分任务。ODBC本身也提供了对SQL语言的支持，用户可以直接将SQL语句送给ODBC。ODBC的设计者们努力使它具有最大的独立性和开放性：与具体的编程语言无关，与具体的数据库系统无关，与具体的操作系统无关。微软公司在1993年以DLL集的方式发布了世界上第一个ODBC产品，现在成为了微软开放服务结构(WOSA，Windows Open Services Architecture)中有关数据库的一个组成部分。微软的ODBC产品其实就是一个ODBC的驱动管理器，提供一个ODBC应用程序到某种ODBC驱动的接口。

ODBC接口定义如下内容：

·   ODBC函数调用库，应用程序通过它可以连接到数据源，执行SQL命令并检索结果

· 基于SQL-99规范的SQL语法

· 一套标准的错误码

· 一套连接并登录到数据源的标准方式

· 对数据类型的标准描述



## 二、主要组成部分：

### 1、  ODBC驱动管理器(ODBC Driver Manager)

负责管理应用程序和驱动程序间的通信，主要功能包括：解析DSN (数据源名称,ODBC的数据源名称在ODBC.INI文件中配置),加载和卸载驱动程序,处理ODBC调用,将其传递给驱动程序。同时其也负责管理 ODBC数据源，旨在简化应用程序与不同数据库系统之间的连接设置和管理。

**windows：**

系统已集成，无需单独安装

**linux：**

需要手动安装unixODBC

### 2、  ODBC驱动(ODBC Driver)

YashanDB的ODBC驱动基于YashanDB原生C驱动开发，其架构大致如下：

![ODBC概要设计图.drawio.png](https://pingcode.yasdb.com/atlas/files/public/67852391a1ad9a3311de683b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyNDksImV4cCI6MTc4MjEzNzA0OX0.r9VPobkURlinsc8zCLDgVM1mEuDpDN86LJYUtrFdWkg)

YashanDB的ODBC驱动功能主要依赖YashanDB原生C驱动的功能。



## 三、句柄设计：

在 ODBC 中，主要有以下几种句柄类型：

### 1、环境句柄（Environment Handle）：

- 表示一个 ODBC 环境，通常是使用 ODBC 的起点。
- 环境句柄包含有关 ODBC 环境的全局信息，如环境状态、错误信息等。
- 用于管理一个或多个数据库连接，以及与之相关的资源。
- 函数 SQLAllocHandle 用于分配环境句柄，例如：


```
SQLHENV henv;
SQLAllocHandle(SQL_HANDLE_ENV, SQL_NULL_HANDLE, &henv);
```

### 2、连接句柄（Connection Handle）：

- 表示一个到数据库的连接。
- 用于建立和管理与特定数据库的连接，执行 SQL 语句，管理事务等操作。
- 通过环境句柄分配，例如：


```
SQLHDBC hdbc;
SQLAllocHandle(SQL_HANDLE_DBC, henv, &hdbc);
```

### 3、语句句柄（Statement Handle）：

- 表示一个 SQL 语句的执行上下文。
- 用于准备、执行和管理 SQL 语句，包括获取结果集、绑定参数、获取元数据等操作。
- 通过连接句柄分配，例如：


```
SQLHSTMT hstmt;
SQLAllocHandle(SQL_HANDLE_STMT, hdbc, &hstmt);
```

### 4、描述符句柄（Descriptor Handle）：

- 包括应用程序描述符句柄（Application Descriptor Handle）和实现描述符句柄（Implementation Descriptor Handle）。
- 描述符句柄用于描述 SQL 语句中的参数或结果集的元数据，如数据类型、长度、精度等信息。
- 可用于设置和获取参数和结果集的信息，例如：


```
SQLHDESC hdesc;
SQLAllocHandle(SQL_HANDLE_DESC, hstmt, &hdesc);
```

### 5、句柄间的关系

#### 层次关系：

- 环境句柄：是最顶层的句柄，它是 ODBC 环境的代表，可包含多个连接句柄。可以将环境句柄看作是一个容器，在这个容器内可以建立多个到不同数据库的连接。
- 连接句柄：从属于环境句柄，一个环境句柄可以分配多个连接句柄，每个连接句柄代表一个到数据库的连接。一个连接句柄可用于与一个数据库系统通信，执行数据库操作。
- 语句句柄：从属于连接句柄，一个连接句柄可以分配多个语句句柄，每个语句句柄代表一个 SQL 语句的执行上下文。通过语句句柄，可以执行 SQL 查询、更新等操作。
- 描述符句柄：通常与语句句柄相关联，为语句句柄提供元数据描述，帮助管理参数和结果集的信息。


#### 使用流程中的关系：

- 首先，使用 SQLAllocHandle 分配环境句柄，初始化 ODBC 环境。
- 然后，在环境句柄的基础上，使用 SQLAllocHandle 分配连接句柄，建立到数据库的连接。
- 接着，在连接句柄的基础上，使用 SQLAllocHandle 分配语句句柄，用于执行 SQL 语句。
- 对于复杂的 SQL 语句操作，可能会使用描述符句柄，通过语句句柄分配描述符句柄，来管理参数和结果集的元数据。


## 四、接口说明：

|**任务**|**函数名称**|**一致性级别**|**目标**|
|---|---|---|---|
|连接到数据源, , , |SQLAllocHandle|ISO 92|获取环境、连接、语句或描述符句柄。|
||SQLConnect|ISO 92|按数据源名称、用户 ID 和密码连接到特定驱动程序。|
||SQLDriverConnect|ODBC|通过连接字符串或请求驱动程序管理器和驱动程序显示用户的连接对话框连接到特定驱动程序。|
||SQLBrowseConnect|ODBC|返回连接属性和有效属性值的连续级别。 为每个连接属性指定值后， 将连接到数据源。|
|获取有关驱动程序和数据源的信息, , , , |SQLDataSources|ISO 92|返回可用数据源的列表。|
||SQLDrivers|ODBC|返回已安装的驱动程序及其属性的列表。|
||SQLGetInfo|ISO 92|返回有关特定驱动程序和数据源的信息。|
||SQLGetFunctions|ISO 92|返回支持的驱动程序函数。|
||SQLGetTypeInfo|ISO 92|返回有关支持的数据类型的信息。|
|设置和检索驱动程序属性, , , , , |SQLSetConnectAttr|ISO 92|设置连接属性。|
||SQLGetConnectAttr|ISO 92|返回连接属性的值。|
||SQLSetEnvAttr|ISO 92|设置环境属性。|
||SQLGetEnvAttr|ISO 92|返回环境属性的值。|
||SQLSetStmtAttr|ISO 92|设置语句属性。|
||SQLGetStmtAttr|ISO 92|返回语句属性的值。|
|设置和检索描述符字段, , , , |SQLGetDescField|ISO 92|返回单个描述符字段的值。|
||SQLGetDescRec|ISO 92|返回多个描述符字段的值。|
||SQLSetDescField|ISO 92|设置单个描述符字段。|
||SQLSetDescRec|ISO 92|设置多个描述符字段。|
||SQLCopyDesc|ISO 92|将描述符信息从一个描述符句柄复制到另一个描述符句柄。|
|准备SQL请求, , , , |SQLPrepare|ISO 92|准备一SQL语句供以后执行。|
||SQLBindParameter|ODBC|为 SQL 语句中的参数分配存储。|
||SQLGetCursorName|ISO 92|返回与语句句柄关联的游标名称。|
||SQLSetCursorName|ISO 92|指定游标名称。|
||SQLSetScrollOptions|ODBC|设置控制游标行为的选项。|
|提交请求, , , , , , |SQLExecute|ISO 92|执行已准备的语句。|
||SQLExecDirect|ISO 92|执行语句。|
||SQLNativeSql|ODBC|返回由驱动程序SQL的 SQL 语句的文本。|
||SQLDescribeParam|ODBC|返回语句中特定参数的说明。|
||SQLNumParams|ISO 92|返回 语句中的参数数。|
||SQLParamData|ISO 92|与   **SQLPutData 结合使用**   ，在执行时提供参数数据。 (长数据值很有用。)|
||SQLPutData|ISO 92|发送参数的一部分或全部数据值。 (长数据值很有用。)|
|检索结果和有关结果的信息, , , , , , , , , , , , |SQLRowCount|ISO 92|返回受插入、更新或删除请求影响的行数。|
||SQLNumResultCols|ISO 92|返回结果集中的列数。|
||SQLDescribeCol|ISO 92|描述结果集的列。|
||SQLColAttribute|ISO 92|描述结果集内列的属性。|
||SQLBindCol|ISO 92|为结果列分配存储并指定数据类型。|
||SQLFetch|ISO 92|返回多个结果行。|
||SQLFetchScroll|ISO 92|返回可滚动的结果行。|
||SQLGetData|ISO 92|返回结果集的一行的一列的一部分或全部。 (长数据值很有用。)|
||SQLSetPos|ODBC|将游标定位在提取的数据块中，并允许应用程序刷新行集的数据，或者更新或删除结果集内的数据。|
||SQLBulkOperations|ODBC|执行批量插入和批量书签操作，包括按书签更新、删除和提取。|
||SQLMoreResults|ODBC|确定是否有更多结果集可用，如果是，则初始化下一个结果集的处理。|
||SQLGetDiagField|ISO 92|返回诊断数据结构 (的单个字段中的其他诊断) 。|
||SQLGetDiagRec|ISO 92|返回诊断数据结构 (多个字段中的其他诊断) 。|
|获取有关数据源的系统表的信息 (目录函数), , , , , , , , , |SQLColumnPrivileges|ODBC|返回一个或多个表的列和关联特权的列表。|
||SQLColumns|OPEN GROUP|返回指定表中的列名的列表。|
||SQLForeignKeys|ODBC|返回由外键（如果指定表存在）的列名的列表。|
||SQLPrimaryKeys|ODBC|返回列名的列表，这些列名是表的主键。|
||SQLProcedureColumns|ODBC|返回输入和输出参数的列表，以及组成指定过程的结果集的列。|
||SQLProcedures|ODBC|返回存储在特定数据源中的过程名称的列表。|
||SQLSpecialColumns|open|返回有关唯一标识指定表中的行的最佳列集的信息，或当事务更新行中的任意值时自动更新的列的信息。|
||SQLStatistics|ISO 92|返回有关单个表以及与该表关联的索引列表的统计信息。|
||SQLTablePrivileges|ODBC|返回表的列表以及与每个表关联的特权。|
||SQLTables|OPEN GROUP|返回存储在特定数据源中的表名的列表。|
|终止语句, , , , |SQLFreeStmt|ISO 92|结束语句处理，放弃挂起的结果，并（可选）释放与语句句柄关联的所有资源。|
||SQLCloseCursor|ISO 92|关闭已在语句句柄上打开的游标。|
||SQLCancel|ISO 92|取消对 语句的处理。|
||SQLCancelHandle|ODBC|取消对语句或连接的处理。|
||SQLEndTran|ISO 92|提交或回滚事务。|
|终止连接, |SQLDisconnect|ISO 92|关闭连接。|
||SQLFreeHandle|ISO 92|释放环境、连接、语句或描述符句柄。|


## 五、测试计划

单元测试：对每个功能模块进行单元测试，使用模拟的函数调用和测试用例，测试功能的正确性。

集成测试：测试不同模块之间的交互，确保整体功能的完整性。

性能测试：使用性能测试工具，测试在不同负载下的性能指标，如响应时间、吞吐量等。