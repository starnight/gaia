'use strict';

var fb = this.fb || {};
fb.CATEGORY = 'facebook';
fb.NOT_LINKED = 'not_linked';
fb.LINKED = 'fb_linked';
fb.PROPAGATED_PREFIX = 'fb_propagated_';

// Types of URLs for FB Information
fb.PROFILE_PHOTO_URI = 'fb_profile_photo';
fb.FRIEND_URI = 'fb_friend';

fb.CONTACTS_APP_ORIGIN = 'app://communications.gaiamobile.org';

// Some convenience functions follow

fb.isFbContact = function(devContact) {
  return (devContact && devContact.category &&
          devContact.category.indexOf(fb.CATEGORY) !== -1);
};


fb.isFbLinked = function(devContact) {
  return (devContact.category &&
                        devContact.category.indexOf(fb.LINKED) !== -1);
};

fb.isPropagated = function fcu_isPropagated(field, devContact) {
  return (devContact.category && devContact.category.
                                  indexOf(fb.PROPAGATED_PREFIX + field) !== -1);
};

fb.removePropagatedFlag = function fcu_removePropagatedFlag(field, devContact) {
  var idx = devContact.category.indexOf(fb.PROPAGATED_PREFIX + field);
  if (idx !== -1) {
    devContact.category.splice(idx, 1);
  }
};

fb.setPropagatedFlag = function fcu_setPropagatedFlag(field, devContact) {
  var idx = devContact.category.indexOf(fb.PROPAGATED_PREFIX + field);
  if (idx === -1) {
    devContact.category.push(fb.PROPAGATED_PREFIX + field);
  }
};

fb.getFriendUid = function(devContact) {
  var out = devContact.uid;

  if (!out) {
    if (fb.isFbLinked(devContact)) {
      out = fb.getLinkedTo(devContact);
    }
    else if (devContact.category) {
      var idx = devContact.category.indexOf(fb.CATEGORY);
      if (idx !== -1) {
        out = devContact.category[idx + 2];
      }
    }
  }

  return out;
};


fb.getLinkedTo = function(devContact) {
  var out;

  if (devContact.category) {
    var idx = devContact.category.indexOf(fb.LINKED);
    if (idx !== -1) {
      out = devContact.category[idx + 1];
    }
  }

  return out;
};


fb.getFriendPictureUrl = function(devContact) {
  var out;

  var urls = devContact.url;

  if (urls) {
    for (var c = 0; c < urls.length; c++) {
      var aurl = urls[c];
      if (aurl.type.indexOf(fb.PROFILE_PHOTO_URI) !== -1) {
        out = aurl.value;
        break;
      }
    }
  }

  return out;
};

fb.setFriendPictureUrl = function(devContact, url) {
  devContact.url = devContact.url || [];

  devContact.url.push({
    type: [fb.PROFILE_PHOTO_URI],
    value: url
  });
};

// Adapts data to the mozContact format names
fb.friend2mozContact = function(f) {

  function normalizeFbPhoneNumber(phone) {
    var out = phone.number;
    if (phone.country_code && out.indexOf('+') !== 0) {
      out = '+' + phone.country_code + out;
    }
    return out;
  }

  // Check whether this has been already normalized to mozContact
  if (Array.isArray(f.familyName)) {
    return f;
  }

// givenName is put as name but it should be f.first_name
  f.familyName = [f.last_name ? f.last_name.trim() : (f.last_name || '')];
  var middleName = f.middle_name ? f.middle_name.trim() : (f.middle_name || '');
  f.additionalName = middleName;
  var firstName = f.first_name ? f.first_name.trim() : (f.first_name || '');
  f.givenName = [(firstName + ' ' + middleName).trim()];

  delete f.last_name;
  delete f.middle_name;
  delete f.first_name;

  var privateType = 'personal';

  if (f.email) {
    f.email1 = f.email;
    f.email = [{
                  type: [privateType],
                  value: f.email
    }];
  }
  else {
    f.email1 = '';
  }

  if (Array.isArray(f.phones) && f.phones.length > 0) {
    f.tel = [];
    f.shortTelephone = [];
    f.phones.forEach(function(aphone) {
      f.tel.push({
        type: [privateType],
        value: normalizeFbPhoneNumber(aphone)
      });
      // Enabling to find FB phones by short number
      f.shortTelephone.push(aphone.number);
    });
  }

  delete f.phones;

  f.uid = f.uid.toString();

  return f;
};


/**
  * Auxiliary function to know where a contact works
  *
*/
fb.getWorksAt = function(fbdata) {
  var out = '';
  if (fbdata.work && fbdata.work.length > 0) {
    // It is assumed that first is the latest
    out = fbdata.work[0].employer.name;
  }

  return out;
};

 /**
  *  Facebook dates are MM/DD/YYYY
  *
  *  Returns the birth date
  *
  */
fb.getBirthDate = function getBirthDate(sbday) {
  var out = new Date();

  var imonth = sbday.indexOf('/');
  var smonth = sbday.substring(0, imonth);

  var iyear = sbday.lastIndexOf('/');
  if (iyear === imonth) {
    iyear = sbday.length;
  }
  var sday = sbday.substring(imonth + 1, iyear);

  var syear = sbday.substring(iyear + 1, sbday.length);

  out.setUTCDate(parseInt(sday, 10));
  out.setUTCMonth(parseInt(smonth, 10) - 1, parseInt(sday, 10));

  if (syear && syear.length > 0) {
    out.setUTCFullYear(parseInt(syear, 10));
  }

  return out;
};

fb.getAddresses = function(fbdata) {

  function fillAddress(fbAddress, type) {
    var outAddr = {};

    outAddr.type = [type];
    outAddr.locality = fbAddress.city || '';
    outAddr.region = fbAddress.state || '';
    outAddr.countryName = fbAddress.country || '';

    return outAddr;
  }

  var out = [];
  var addrTypes = {
    'home': 'hometown_location',
    'current': 'current_location'
  };

  Object.keys(addrTypes).forEach(function onAddressType(type) {
    var addrObj = fbdata[addrTypes[type]];
    if (addrObj) {
      out.push(fillAddress(addrObj, type));
    }
  });
  return out;
};

// The contact is now totally unlinked
// [...,facebook, fb_not_linked, 123456,....]
fb.markAsUnlinked = function(devContact) {
  var category = devContact.category;
  var updatedCategory = [];

  if (category) {
    var idx = category.indexOf(fb.CATEGORY);
    if (idx !== -1) {
      for (var c = 0; c < idx; c++) {
        updatedCategory.push(category[c]);
      }
      // The facebook category, the linked mark and the UID are skipped
      for (var c = idx + 3; c < category.length; c++) {
         updatedCategory.push(category[c]);
      }
    }
  }

  devContact.category = updatedCategory;

  return devContact;
};

// Merge done specifically for dialer and Call Log apps
fb.mergeContact = function(devContact, fbContact) {
  var fbPhotos = fbContact.photo;

  var devPhotos = devContact.photo || [];

  if (Array.isArray(fbPhotos) && fbPhotos.length > 0 && fbPhotos[0]) {
    devPhotos.push(fbPhotos[0]);
    devContact.photo = devPhotos;
  }

  var devTels = devContact.tel || [];

  if (Array.isArray(fbContact.tel)) {
    fbContact.tel.forEach(function(atel) {
      devTels.push(atel);
    });
    devContact.tel = devTels;
  }

  // It is needed to merge names just in case the contact has no local name
  fb.mergeNames(devContact, fbContact);

  return devContact;
};

fb.mergeNames = function(devContact, fbContact) {
  var namesChanged = false;
  var nameFields = ['givenName', 'familyName'];
  nameFields.forEach(function(anameField) {
    // If the device contact does not have name fields setted
    // we use the Facebook ones
    var fieldValue = devContact[anameField];
    var fbValue = fbContact[anameField];
    if ((!Array.isArray(fieldValue) || fieldValue.length === 0) &&
        Array.isArray(fbValue) && fbValue.length > 0) {
      namesChanged = true;
      devContact[anameField] = (fieldValue && fieldValue[0]) || [];
      devContact[anameField].push(fbValue[0]);
    }
  });

  if (namesChanged) {
    var givenName = devContact.givenName[0] || '';
    var familyName = devContact.familyName[0] || '';
    devContact.name = [givenName + ' ' + familyName];
  }
};

fb.getContactByNumber = function(number, onsuccess, onerror) {
  var req = fb.contacts.getByPhone(number);

  req.onsuccess = function(e) {
    onsuccess(e.target.result);
  };

  req.onerror = onerror;
};

// Only will be executed in the case of not loading fb.utils previously
// i.e. dialer and call log FB integration
fb.utils = this.fb.utils || {};

// Returns the mozContact associated to a UID in FB
fb.utils.getMozContactByUid = function(uid, onsuccess, onerror) {
  var filter = {
    filterBy: ['category'],
    filterValue: uid,
    filterOp: 'contains'
  };

  var req = navigator.mozContacts.find(filter);
  req.onsuccess = onsuccess;
  req.onerror = onerror;
};

 /**
  *   Request auxiliary object to support asynchronous calls
  *
  */
fb.utils.Request = function() {
  this.done = function(result) {
    this.result = result;
    if (typeof this.onsuccess === 'function') {
      var ev = {};
      ev.target = this;
      window.setTimeout(function() {
        this.onsuccess(ev);
      }.bind(this), 0);
    }
  };

  this.failed = function(error) {
    this.error = error;
    if (typeof this.onerror === 'function') {
      var ev = {};
      ev.target = this;
      window.setTimeout(function() {
        this.onerror(ev);
      }.bind(this), 0);
    }
  };
};
