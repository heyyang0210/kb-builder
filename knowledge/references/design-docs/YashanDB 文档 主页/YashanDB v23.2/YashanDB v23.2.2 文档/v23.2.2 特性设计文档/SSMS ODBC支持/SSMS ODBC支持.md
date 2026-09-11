Created by 冯皓博, last modified on 二月 20, 2024

  


|  
|接口|描述|工作量|
|:---|:---|:---|---|
|1|SQLSetConnectAttr|参数：SQL_OV_ODBC2,返回success|可适配放开，0|
|2|SQLColumns|现在使用桩函数，可以正常使用。,是否需要实现具体功能，需要分析。|需要支持，开发+自测3day|
|3|nvarchar类型|表中有nvarchar类型时查询报错。,添加类型后，中文打印正常|可适配，0|
|4|lob类型查询|需要调试解决|可调试解决|
|5|insert插入报错|具体看log,暂时可以不做。|尚未定位，推测是SQLColumns未实现导致的|
