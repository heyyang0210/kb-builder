Created by 冯皓博 on 一月 18, 2024

  [YDBRD-15277](https://jira.yasdb.com/browse/YDBRD-15277?src=confmacro)    -  【驱动】odbc支持oracle通过dblink连通yashandb，实现基础功能  完成

该函数常用于ODBC框架不预先绑定直接获取数据，相比于绑定流程获取结果集更简单

  [SQLGetData 函数 - ODBC API Reference | Microsoft Learn](https://learn.microsoft.com/zh-cn/sql/odbc/reference/syntax/sqlgetdata-function?view=sql-server-ver16)  

```
SQLRETURN SQLGetData(  
      SQLHSTMT       StatementHandle,  
      SQLUSMALLINT   Col_or_Param_Num,  
      SQLSMALLINT    TargetType,  
      SQLPOINTER     TargetValuePtr,  
      SQLLEN         BufferLength,  
      SQLLEN *       StrLen_or_IndPtr);
```

## 使用 SQLGetData的限制：

1、驱动程序可以放宽其中的任何限制。 为了确定驱动程序放宽哪些限制，应用程序使用以下任一SQL_GETDATA_EXTENSIONS选项调用     **SQLGetInfo**     ：

- SQL_GD_OUTPUT_PARAMS =     **SQLGetData**     可以调用以返回输出参数值。 有关详细信息，请参阅       [使用 SQLGetData 检索输出参数](https://learn.microsoft.com/zh-cn/sql/odbc/reference/develop-app/retrieving-output-parameters-using-sqlgetdata?view=sql-server-ver16)    。
- SQL_GD_ANY_COLUMN。 如果返回此选项，则可以对任何未绑定列（包括最后一个绑定列之前的列）调用     **SQLGetData**     。
- SQL_GD_ANY_ORDER。 如果返回此选项，则可以按任意顺序为未绑定列调用     **SQLGetData**     。
- SQL_GD_BLOCK。 如果     **SQLGetInfo**     为 SQL_GETDATA_EXTENSIONS InfoType 返回此选项，则当行集大小大于 1 时，驱动程序支持调用     **SQLGetData**  ，并且应用程序可以使用 SQL_POSITION 选项调用     **SQLSetPos**  ，以便在调用     **SQLGetData**     之前将光标置于正确的行上。
- SQL_GD_BOUND。 如果返回此选项，则可以为绑定列和未绑定列调用     **SQLGetData**     。


目前支持SQL_GD_ANY_COLUMN、SQL_GD_ANY_ORDER、SQL_GD_BOUND、SQL_GD_BLOCK

2、  **SQLGetData**   可用于从包含可变长度数据的列中检索数据

应用程序会连续多次为同一列调用     **SQLGetData**  来多段获取数据

目前不支持应用程序多次调用，仅支持单次调用

3、  如果     *TargetType*     参数是间隔数据类型，则默认间隔前导精度 (2) 和默认间隔秒精度 (6) ，如 ARD 的SQL_DESC_DATETIME_INTERVAL_PRECISION和SQL_DESC_PRECISION字段中设置的那样，将分别用于数据。 如果     *TargetType*     参数是SQL_C_NUMERIC数据类型，则默认精度 (驱动程序定义的) 和默认小数位数 (0) （如 ARD 的SQL_DESC_PRECISION和SQL_DESC_SCALE字段中设置）用于数据。     如果任何默认精度或小数位数都不适用，应用程序应通过调用   **SQLSetDescField**   或   **SQLSetDescRec**   显式设置相应的描述符字段。 它可以将SQL_DESC_CONCISE_TYPE字段设置为SQL_C_NUMERIC，并使用   *targetType*   参数SQL_ARD_TYPE调用   **SQLGetData**  ，这将导致使用描述符字段中的精度和小数位数值。

当前没做SQL_ARD_TYPE类型

  


  
