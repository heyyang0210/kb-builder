Created by 程康, last modified on 十一月 13, 2024

|**sql**|**mysql**|**yashan**|
|---|---|---|
|**select truncate(1,'');**|**warning**|**x**|
|**select truncate(1,' ');**|**warning**|**x**|
|**select truncate('',2);**|**0.00**|**0（double）**|
|**select truncate(' ',2);**|**0.00**|**0（double）**|
|**select truncate(null,null);**|**null**|**null**|


**yashan ‘’ = null **

**mysql ‘’ = ‘ ’ **

**yashan:**

**建库参数 EMPTY_STRING_AS_NULL = false **

**设置区分null与空串**

**对于空串在第一个参数的情况：**

**select truncate('',2);**

**select truncate(' ',2);**    
    


**返回值：**

** 按照 varchar推导 返回double类型  值为0**

  
