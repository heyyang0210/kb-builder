IR :   [https://pingcode.yasdb.com/pjm/items/670e0efae489dd0868f7ac62? ](https://pingcode.yasdb.com/pjm/items/670e0efae489dd0868f7ac62?)  #YDBRD-34198 【mysql兼容】兼容与MYSQL DECODE等同名函数规格

SR:   [https://pingcode.yasdb.com/pjm/items/670e0efb6544792659b370f5? ](https://pingcode.yasdb.com/pjm/items/670e0efb6544792659b370f5?)  #YDBRD-34200 开发任务：【mysql兼容】兼容与MYSQL DECODE等同名函数规格



#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#1-%E6%80%BB%E8%BF%B0)  

在原有的mysql框架之上，适配 encode()函数、decode(), md5()函数。



#   [1.1 需求合理性分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#11-%E9%9C%80%E6%B1%82%E5%90%88%E7%90%86%E6%80%A7%E5%88%86%E6%9E%90)  

  


##   [1.2 需求实现分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#12-%E9%9C%80%E6%B1%82%E5%AE%9E%E7%8E%B0%E5%88%86%E6%9E%90)  

### 1.2.1 encode函数

加密处理函数。使用指定的密码对字符串进行加密，返回一个与字符串长度相同的二进制字符串。



**函数定义**

```
ENCODE(str, pass_str)
输入参数：
  str : 要加密的字符串
  pass_str: 密码字符串
返回值：同str长度相同的二进制字符串，类型 varbinary ,字符集 my_charset_bin 。若任一参数为NULL，则返回NULL。
```



**说明**

对encode加密的结果，可以使用DECODE使用相同的密码字符串进行解密。

参数1或参数2若不能转为字符串类型，函数结果返回NULL。

ENCODE函数、DECODE函数在MySQL8.0版本已被移除，可以考虑使用AES_ENCRYPT()和 AES_DECRYPT()函数作为替换。 

入参长度测试：发现没有限制，测试如下

```
mysql>  select length(  encode( repeat('ab', 2000000),    repeat('ab', 2000000)  ) );
+-----------------------------------------------------------------------+
| length(  encode( repeat('ab', 2000000),    repeat('ab', 2000000)  ) ) |
+-----------------------------------------------------------------------+
|                                                               4000000 |
+-----------------------------------------------------------------------+
1 row in set, 1 warning (0.13 sec)

mysql>  select length(  decode( repeat('ab', 2000000),    repeat('ab', 2000000)  ) );
+-----------------------------------------------------------------------+
| length(  decode( repeat('ab', 2000000),    repeat('ab', 2000000)  ) ) |
+-----------------------------------------------------------------------+
|                                                               4000000 |
+-----------------------------------------------------------------------+
1 row in set, 1 warning (0.14 sec)
```



**函数实现**

```
变量
  // SQL_CRYPT
  struct rand_struct rand;
  struct rand_struct org_rand;
  char decode_buff[256];
  char encode_buff[256];
  uint shift;
 //Item_func_encode
  bool seeded;

函数
Create_func_encode::create

Item_func_encode::fix_length_and_dec
    Item_func_encode::seed（前提：pass_str为常量&&字符串类型）
        hash_password
        SQL_CRYPT::init

Item_func_encode::val_str
    Item_func_encode::seed（前提:没执行过该函数）
        hash_password
        SQL_CRYPT::init
    Item_func_encode::crypto_transform
        SQL_CRYPT::encode
    SQL_CRYPT::reinit
```



函数对变量的处理说明：

（1）根据参数2的值，设置 struct rand_struct rand 的值 （函数hash_password）

（2）根据struct rand_struct rand 的值， 设置decode_buff[256], encode_buff[256] 的值，rand值也会更新。将rand值备份为org_rand。shift=0。（函数SQL_CRYPT::init）

（3）根据 encode_buff, 参数1的内容，生成函数执行结果（函数SQL_CRYPT::encode）

（4）重置参数，将 shift=0; rand=org_rand; （函数 SQL_CRYPT:: reinit）



若pass_str为常量，只需要执行1次 Item_func_encode::seed， 生成后面加密需要的参数：rand, decode_buff, encode_buff，若语句中多次执行encode，只需要调用 Item_func_encode::crypto_transform 处理即可。

若pass_str不是常量，则执行encode时，需要每次都根据pass_str重新生成 rand, decode_buff, encode_buff，调用 Item_func_encode::crypto_transform 处理。









```
// seed 函数
bool Item_func_encode::seed()
{
  char buf[80];
  ulong rand_nr[2];
  String *key, tmp(buf, sizeof(buf), system_charset_info);

  if (!(key= args[1]->val_str(&tmp)))
    return TRUE;

  hash_password(rand_nr, key->ptr(), key->length());
  sql_crypt.init(rand_nr);

  return FALSE;
}

// hash_password 函数
void hash_password(ulong *result, const char *password, uint password_len)
{
  ulong nr=1345345333L, add=7, nr2=0x12345671L;
  ulong tmp;
  const char *password_end= password + password_len;
  for (; password < password_end; password++)
  {
    if (*password == ' ' || *password == '\t')
      continue;                                 /* skip space in password */
    tmp= (ulong) (uchar) *password;
    nr^= (((nr & 63)+add)*tmp)+ (nr << 8);
    nr2+=(nr2 << 8) ^ nr;
    add+=tmp;
  }
  result[0]=nr & (((ulong) 1L << 31) -1L); /* Don't use sign bit (str2int) */;
  result[1]=nr2 & (((ulong) 1L << 31) -1L);
}

// sql_crypt.init 函数
void SQL_CRYPT::init(ulong *rand_nr)
{
  uint i;
  randominit(&rand,rand_nr[0],rand_nr[1]);

  for (i=0 ; i<=255; i++)
   decode_buff[i]= (char) i;

  for (i=0 ; i<= 255 ; i++)
  {
    int idx= (uint) (my_rnd(&rand)*255.0);
    char a= decode_buff[idx];
    decode_buff[idx]= decode_buff[i];
    decode_buff[+i]=a;
  }
  for (i=0 ; i <= 255 ; i++)
   encode_buff[(uchar) decode_buff[i]]=i;
  org_rand=rand;
  shift=0;
}

// crypto_transform 函数
void Item_func_encode::crypto_transform(String *res)
{
  push_deprecated_warn(current_thd, "ENCODE", "AES_ENCRYPT");
  sql_crypt.encode((char*) res->ptr(),res->length());
  res->set_charset(&my_charset_bin);
}

//encode 函数
void SQL_CRYPT::encode(char *str, size_t length)
{
  for (size_t i=0; i < length; i++)
  {
    shift^=(uint) (my_rnd(&rand)*255.0);
    uint idx= (uint) (uchar) str[0];
    *str++ = (char) ((uchar) encode_buff[idx] ^ shift);
    shift^= idx;
  }
}

// reinit 函数
void reinit() { shift=0; rand=org_rand; }


```



**字符集对encode函数的影响**

对于encode函数，如果输入参数为常量字符串，在则执行encode函数时，对应的输入参数内容会转为 character_set_connection 对应的字符集类型，输出结果为 设置为 my_charset_bin 字符集类型。

若输入参数为常量非字符串，比如整数，不会进行字符集转换，仍保留语法解释时识别的字符集（比如整数会识别为 my_charset_bin），在encode函数中，会将该参数转为字符串形式，设置对应的字符集（参数为整数会设置为my_charset_latin1），经运算处理后输出结果为 设置为 my_charset_bin 字符集类型。

如果是从系统表中读取的字段值，则参数对应的字符集为列属性对应的字符集。



### 1.2.1 decode函数

解密处理函数。使用指定的密码对加密字符串进行解密。



**函数定义**

```
DECODE(crypt_str, pass_str)
输入参数：
  crypt_str: 加密字符串
  pass_str: 密码字符串
返回值：同crypt_str长度相同的字符串， 类型 varbinary。若任一参数为NULL，则返回NULL。
```



**说明**

参数1或参数2若不能转为字符串类型，函数结果返回NULL。



**函数实现**



```
变量
  // SQL_CRYPT
  struct rand_struct rand;
  struct rand_struct org_rand;
  char decode_buff[256];
  char encode_buff[256];
  uint shift;
 //Item_func_encode
  bool seeded;

函数
Create_func_decode::create

Item_func_encode::fix_length_and_dec
    Item_func_encode::seed（前提：pass_str为常量&&字符串类型）
        hash_password
        SQL_CRYPT::init

Item_func_encode::val_str
    Item_func_encode::seed（前提:没执行过该函数）
        hash_password
        SQL_CRYPT::init
    Item_func_decode::crypto_transform
        SQL_CRYPT::decode               
    SQL_CRYPT::reinit
```





```
//decode 函数
void SQL_CRYPT::decode(char *str, size_t length)
{
  for (size_t i=0; i < length; i++)
  {
    shift^=(uint) (my_rnd(&rand)*255.0);
    uint idx= (uint) ((uchar) str[0] ^ shift);
    *str = decode_buff[idx];
    shift^= (uint) (uchar) *str++;
  }
}
```





### 1.2.3 md5函数

计算字符串的MD5 128位校验和。该值以32个十六进制数字的字符串形式返回，如果参数为NULL，则返回NULL。



**函数定义**

```
MD5(str)
输入参数
  str : 字符串
返回值
  32个十六进制数字的字符串，若参数为NULL则返回NULL。
```



**函数实现**

Item_func_md5::val_str_ascii 函数实现md5算法。

```
#include <my_md5.h>

Item_func_md5::val_str_ascii
     compute_md5_hash
         my_md5_hash
              MD5_Init
              MD5_Update
              MD5_Final
     array_to_hex
         
    
```





##   [1.3 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#13-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|无||||






##   [1.4 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#14-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

md5库



#   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#2-%E6%8E%A5%E5%8F%A3)  

String *Item_func_encode::val_str(String *str)；



void SQL_CRYPT::init(ulong *rand_nr)；

void SQL_CRYPT::encode(char *str, size_t length)；

void SQL_CRYPT::decode(char *str, size_t length)；



void hash_password(ulong *result, const char *password, uint password_len)；



  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

无

##   [4. Dependency（功能依赖）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#4-dependency%E5%8A%9F%E8%83%BD%E4%BE%9D%E8%B5%96)  

  


##   [5. 参考](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

MySQL  Reference Manual 中内置函数章节 （  [https://dev.mysql.com/doc/refman/5.7/en/encryption-functions.html#function_encode](https://dev.mysql.com/doc/refman/5.7/en/encryption-functions.html#function_encode)  ）







